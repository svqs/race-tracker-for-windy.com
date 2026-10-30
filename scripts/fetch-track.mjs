// Copies new positions from the tracker's feed into data/track.json (run by .github/workflows/update-track.yml).
//
// Which feed is set in the repository's Settings → Secrets and variables → Actions:
//   variable TRACK_FEED_TYPE   yb (YB / YellowBrick tracker), inreach (Garmin MapShare KML feed) or json (a list of
//                              positions); empty = manual updates only
//   variable TRACK_FEED_URL    the tracker's public page or feed, e.g. https://app.yb.tl/<name> for YB,
//                              https://share.garmin.com/Feed/Share/<MapShare name> for inReach
//   variable TRACK_FEED_EVENT  YB only, when the page link has one: the event number (…?event=1234)
//   variable TRACK_FEED_SPEED  YB only: the unit of the speeds in the feed, kn (default), kmh or ms
//   secret   TRACK_FEED_PASSWORD  only if the feed has a password (Garmin MapShare: the MapShare password)
//
// New positions are added to the ones already in the file; nothing is ever removed. When nothing new came in,
// the file isn't touched (and the Action makes no commit).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = process.argv[2] || 'data/track.json';
const type = (process.env.TRACK_FEED_TYPE || '').trim().toLowerCase();
const url = (process.env.TRACK_FEED_URL || '').trim();
const password = process.env.TRACK_FEED_PASSWORD || '';
if (!type || !url) {
    console.log('No feed set (TRACK_FEED_TYPE / TRACK_FEED_URL): track.json is updated by hand.');
    process.exit(0);
}
const race = JSON.parse(readFileSync('data/race.json', 'utf8'));
/** a number from the feed, or null when it's missing or not a number (Number(null) would be 0: a boat off Africa) */
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const place = (lat, lon) => (lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180);
const old = JSON.parse(readFileSync(FILE, 'utf8'));
const points = Array.isArray(old.points) ? old.points : [];
// ask for positions since the last one we have (or since 6 hours before the start)
// (a stored position from the future, from before this check existed, doesn't count)
const known = points.map(p => Date.parse(p.t)).filter(t => isFinite(t) && t <= Date.now() + 3600e3);
const since = known.length ? Math.max(...known) : Date.parse(race.start.time) - 6 * 3600e3;

const headers = { 'user-agent': 'racetrack-windy-plugin (github action)' };
if (password) headers.authorization = 'Basic ' + Buffer.from(`:${password}`).toString('base64');

async function get(u) {
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error(`the feed answered ${r.status} ${r.statusText}`);
    return r.text();
}

/** Garmin inReach MapShare: KML with one Placemark per position (time, coordinates, Velocity in km/h, Course in degrees) */
async function inreach() {
    const u = new URL(url);
    u.searchParams.set('d1', new Date(since - 60e3).toISOString().replace(/\.\d+Z$/, 'Z'));
    const kml = await get(u.toString());
    const out = [];
    for (const pm of kml.split('<Placemark').slice(1)) {
        const when = pm.match(/<when>([^<]+)<\/when>/)?.[1];
        const coords = pm.match(/<coordinates>\s*([-\d.]+),([-\d.]+)/);
        if (!when || !coords) continue;
        const data = name => pm.match(new RegExp(`<Data name="${name}">\\s*<value>([^<]*)</value>`))?.[1] || '';
        const kmh = parseFloat(data('Velocity'));
        const course = parseFloat(data('Course'));
        out.push({ t: new Date(when).toISOString(), lat: +parseFloat(coords[2]).toFixed(5), lon: +parseFloat(coords[1]).toFixed(5),
            sog: isFinite(kmh) ? +(kmh / 1.852).toFixed(1) : null, cog: isFinite(course) ? Math.round(course) : null });
    }
    return out;
}

/**
 * YB (YellowBrick) tracker: the positions behind its public map page (app.yb.tl/<name>), read from YB's map API
 * (APIX/Blog/GetPositions). Each position has "at" (time), lat, lng, speed and course.
 * Check the first run against the YB page: the speed unit and the time format aren't documented publicly.
 */
async function yb() {
    const page = new URL(url);
    const keyword = page.searchParams.get('keyword') || page.pathname.split('/').filter(Boolean).pop();
    const event = process.env.TRACK_FEED_EVENT || page.searchParams.get('event') || '';
    if (!keyword) throw new Error('TRACK_FEED_URL needs the YB page of the tracker, e.g. https://app.yb.tl/<name>');
    const api = new URL(process.env.TRACK_FEED_API || 'https://app.yb.tl/APIX/Blog/GetPositions');
    api.searchParams.set('keyword', keyword);
    if (event) api.searchParams.set('event', event);
    api.searchParams.set('_', String(Date.now()));
    const body = JSON.parse(await get(api.toString()));
    const list = Array.isArray(body?.positions) ? body.positions : Array.isArray(body) ? body : [];
    const toKnots = { kn: 1, kt: 1, kmh: 1 / 1.852, ms: 1.943844 }[(process.env.TRACK_FEED_SPEED || 'kn').toLowerCase()] ?? 1;
    return list.map(p => {
        const at = Number(p.at);
        const t = Number.isFinite(at) && at > 0 ? new Date(at < 1e11 ? at * 1000 : at) : new Date(p.datetime);
        if (Number.isNaN(t.getTime())) return null;
        const lat = num(p.lat);
        const lon = num(p.lng ?? p.lon);
        if (!place(lat, lon)) return null;
        const speed = num(p.speed);
        const course = num(p.course);
        return { t: t.toISOString(), lat: +lat.toFixed(5), lon: +lon.toFixed(5),
            sog: speed !== null ? +(speed * toKnots).toFixed(1) : null, cog: course !== null ? Math.round(course) : null };
    }).filter(Boolean);
}

/** Any JSON list of positions: [{t, lat, lon, sog (knots), cog}] or {points: [...]} */
async function json() {
    const body = JSON.parse(await get(url));
    const list = Array.isArray(body) ? body : body.points || [];
    return list.map(p => {
        const t = new Date(p.t ?? p.time);
        const lat = num(p.lat);
        const lon = num(p.lon ?? p.lng);
        if (Number.isNaN(t.getTime()) || !place(lat, lon)) return null;
        return { t: t.toISOString(), lat, lon, sog: num(p.sog ?? p.speed), cog: num(p.cog ?? p.course) };
    }).filter(Boolean);
}

const readers = { yb, inreach, json };
if (!readers[type]) throw new Error(`TRACK_FEED_TYPE "${type}" is not one of: ${Object.keys(readers).join(', ')}`);
// new ones only: after the last we have, not from the future (a tracker clock glitch would block everything after it),
// with a real place, and each time once (feeds repeat positions)
const seen = new Set();
const fresh = (await readers[type]()).filter(p => {
    const t = Date.parse(p.t);
    if (!isFinite(t) || t <= since || t > Date.now() + 3600e3 || !place(p.lat, p.lon) || seen.has(t)) return false;
    seen.add(t);
    return true;
});
if (!fresh.length) {
    console.log('No new positions.');
    process.exit(0);
}
const all = [...points, ...fresh].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
// one position per line: small, and every update is easy to read in the history
writeFileSync(FILE, `{\n    "updated": "${new Date().toISOString()}",\n    "points": [\n${all.map(p => '        ' + JSON.stringify(p)).join(',\n')}\n    ]\n}\n`);
console.log(`Added ${fresh.length} positions (now ${all.length}).`);
