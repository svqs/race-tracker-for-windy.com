// Copies new positions from the tracker's feed into data/track.json (run by .github/workflows/update-track.yml).
//
// Which feed is set in the repository's Settings → Secrets and variables → Actions:
//   variable TRACK_FEED_TYPE   yb (YB / YellowBrick tracker), inreach (Garmin MapShare KML feed) or json (a list of
//                              positions); empty = manual updates only
//   variable TRACK_FEED_URL    the tracker's public page or feed, e.g. https://my.yb.tl/<name> for YB,
//                              https://share.garmin.com/Feed/Share/<MapShare name> for inReach
//   variable TRACK_FEED_EVENT  YB only, optional: the event number (default: YB's default event for the tracker)
//   variable TRACK_FEED_SPEED  YB only: the unit of the speeds in the feed, kn (default), kmh or ms
//   secret   TRACK_FEED_PASSWORD  only if the feed has a password (Garmin MapShare: the MapShare password)
//
// race.json "official" (the organisers' tracker): positions newer than the official map shows wait (scripts/official.mjs).
//
// New positions are added to the ones already in the file; nothing is ever removed. When nothing new came in,
// the file isn't touched (and the Action makes no commit).
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { readOfficial, gate, compare } from './official.mjs';

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
// ask for positions since the last one we have; the first time, from the last day (so before the start the boat
// shows where it is now) or from 6 hours before the start, whichever is earlier
// (a stored position from the future, from before this check existed, doesn't count)
const known = points.map(p => Date.parse(p.t)).filter(t => isFinite(t) && t <= Date.now() + 3600e3);
const since = known.length ? Math.max(...known) : Math.min(Date.parse(race.start.time) - 6 * 3600e3, Date.now() - 24 * 3600e3);

const headers = { 'user-agent': 'racetrack-windy-plugin (github action)' };
if (password) headers.authorization = 'Basic ' + Buffer.from(`:${password}`).toString('base64');

async function get(u) {
    // never wait forever: a feed that doesn't answer would stop every update after it
    const r = await fetch(u, { headers, signal: AbortSignal.timeout(30e3) });
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
 * YB (YellowBrick) tracker: the positions behind its public map page (my.yb.tl/<name> or app.yb.tl/<name>), read from
 * YB's map API (APIX/Blog/GetPositions?keyword=<name>&event=<number>), the same calls the page makes. YB needs the
 * event number: without TRACK_FEED_EVENT, the default one from APIX/Blog/GetEvents is used (checked 30 Oct 2026 on
 * my.yb.tl/oceancall: one event, "All time"). Each position has "at" (time, ms), "t" (latitude), "g" (longitude);
 * speed and course aren't in it (the plugin works them out from the positions).
 * Check the first run against the YB page: the speed unit isn't documented publicly.
 */
async function yb() {
    const page = new URL(url);
    const keyword = page.searchParams.get('keyword') || page.pathname.split('/').filter(Boolean).pop();
    if (!keyword) throw new Error('TRACK_FEED_URL needs the YB page of the tracker, e.g. https://my.yb.tl/<name>');
    const api = new URL(process.env.TRACK_FEED_API || 'https://app.yb.tl/APIX/Blog/GetPositions');
    /** YB answers 200 with {"error": "..."} when it can't: that's a failed run, not "no new positions" */
    const ask = async (u) => {
        const body = JSON.parse(await get(u.toString()));
        if (body && typeof body === 'object' && !Array.isArray(body) && body.error) throw new Error(`YB answered: ${body.error}`);
        return body;
    };
    let event = process.env.TRACK_FEED_EVENT || page.searchParams.get('event') || '';
    if (!event) {
        const ev = new URL(api.toString().replace(/GetPositions/, 'GetEvents'));
        ev.searchParams.set('keyword', keyword);
        const events = (await ask(ev))?.events;
        const list = Array.isArray(events) ? events : [];
        const pick = list.find(e => e.default) || list.slice().sort((a, b) => (b.startTime || 0) - (a.startTime || 0))[0];
        if (!pick?.id) throw new Error(`YB has no event for "${keyword}": set TRACK_FEED_EVENT`);
        event = String(pick.id);
        console.log(`YB event ${event} (${pick.name || 'no name'})`);
    }
    api.searchParams.set('keyword', keyword);
    api.searchParams.set('event', event);
    api.searchParams.set('_', String(Date.now()));
    const body = await ask(api);
    const list = Array.isArray(body?.positions) ? body.positions : Array.isArray(body) ? body : [];
    const toKnots = { kn: 1, kt: 1, kmh: 1 / 1.852, ms: 1.943844 }[(process.env.TRACK_FEED_SPEED || 'kn').toLowerCase()] ?? 1;
    return list.map(p => {
        const at = Number(p.at);
        const t = Number.isFinite(at) && at > 0 ? new Date(at < 1e11 ? at * 1000 : at) : new Date(p.datetime);
        if (Number.isNaN(t.getTime())) return null;
        // YB's map feed uses short names (seen 30 Oct 2026 on my.yb.tl/oceancall: {"at": ms, "t": lat, "g": lon, "id"});
        // longer ones (lat, lng, speed, course) are read too
        const lat = num(p.lat ?? p.t);
        const lon = num(p.lng ?? p.lon ?? p.g);
        if (!place(lat, lon)) return null;
        const speed = num(p.speed ?? p.s);
        const course = num(p.course ?? p.c);
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
let fresh = (await readers[type]()).filter(p => {
    const t = Date.parse(p.t);
    if (!isFinite(t) || t <= since || t > Date.now() + 3600e3 || !place(p.lat, p.lon) || seen.has(t)) return false;
    seen.add(t);
    return true;
});

// SWITCHED OFF on 1 Nov 2026 (decided with the team): the official map showed no positions for boat 59 before the start,
// so this check held back every position and track.json stayed empty. Positions from YB are published without it, so
// racetrack can now be AHEAD of the organisers' map. To turn it back on, remove the "// " from the block below (the
// official map is read again, positions newer than it wait, and the run's log compares both tracks).
//
// the official tracker (race.json "official"): never show a position the organisers' map doesn't show yet. Newer ones
// wait here (the feed sends them again next time). If the official map can't be read, nothing new is published and
// the run fails, so someone notices. OFFICIAL_CHECK=off skips it (e.g. if the organisers' map is down for long).
// if (race.official?.url && (process.env.OFFICIAL_CHECK || '').toLowerCase() !== 'off') {
//     const official = await readOfficial(race.official, race.athlete?.name);
//     const g = gate(fresh, official);
//     fresh = g.kept;
//     const c = compare([...points, ...fresh], official);
//     const when = t => (t ? new Date(t).toISOString().replace(/:\d\d\.\d+Z$/, ' UTC').replace('T', ' ') : 'none');
//     const lines = [
//         `Official map: ${official.name} (boat ${official.id}), ${official.points.length} positions, newest ${when(c.lastOfficial)}.`,
//         `Showing up to ${when(g.until)}${g.held ? `; ${g.held} newer position(s) wait for the official map` : ''}.`,
//         c.compared ? `Compared ${c.compared} official position(s) with ours: at most ${c.worstNm} NM apart.` : 'Nothing to compare yet (no official position after the start).',
//     ];
//     if (c.worstNm > 2) lines.push(`WARNING: our track is ${c.worstNm} NM away from the official one somewhere: check the tracker.`);
//     console.log(lines.join('\n'));
//     if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Official tracker\n\n${lines.map(l => `- ${l}`).join('\n')}\n`);
// }

if (!fresh.length) {
    console.log('No new positions.');
    process.exit(0);
}
const all = [...points, ...fresh].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
// one position per line: small, and every update is easy to read in the history
writeFileSync(FILE, `{\n    "updated": "${new Date().toISOString()}",\n    "points": [\n${all.map(p => '        ' + JSON.stringify(p)).join(',\n')}\n    ]\n}\n`);
console.log(`Added ${fresh.length} positions (now ${all.length}).`);
