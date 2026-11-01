// Feed scenarios: the GitHub Action's reader (scripts/fetch-track.mjs) against a fake tracker on this computer.
// node scripts/test-feed.mjs   (part of npm run check; the scenarios are listed in docs/testing.md, section F)
// Each scenario runs the real script in a fresh folder with a copy of data/race.json and a track.json, the way the
// Action does, then checks track.json (and runs scripts/check-data.mjs on it, like the Action before committing).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const H = 3600e3;
const NOW = Date.now();
const START = NOW - 30 * H;
const iso = t => new Date(t).toISOString();
const race = { athlete: { name: 'Milan Koláček' }, start: { name: 'Saint-Malo', lat: 48.68, lon: -2.02, time: iso(START) }, finish: { name: 'Pointe-à-Pitre', lat: 16.22, lon: -61.53 } };

// what the fake tracker answers, set per scenario
let answer = { status: 200, type: 'application/json', body: '{}' };
// YB's list of events for a tracker (asked first when no TRACK_FEED_EVENT is set), as my.yb.tl/oceancall answered
let events = { events: [{ colour: '#FF0000', default: true, name: 'All time', start: '1970-01-01 00:00:00', startTime: 0, id: 17480, isFixed: true }] };
const server = createServer((req, res) => {
    if (req.url.includes('GetEvents')) {
        server.lastEvents = req.url;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(events));
        return;
    }
    server.last = req.url;
    res.writeHead(answer.status, { 'content-type': answer.type });
    res.end(answer.body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const yb = list => ({ status: 200, type: 'application/json', body: JSON.stringify({ positions: list }) });
const ybPos = (h, o = {}) => ({ at: Math.floor((START + h * H) / 1000), lat: 48.5 - h * 0.1, lng: -2.4 - h * 0.2, speed: 10, course: 245, ...o });

function folder(points = []) {
    const dir = mkdtempSync(path.join(tmpdir(), 'racetrack-feed-'));
    mkdirSync(path.join(dir, 'data'));
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify(race));
    writeFileSync(path.join(dir, 'data/track.json'), JSON.stringify({ updated: null, points }, null, 4));
    return dir;
}
// this computer's environment without any feed settings, so every scenario sets exactly its own
const CLEAN_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('TRACK_FEED_')));
function run(dir, env, script = 'scripts/fetch-track.mjs', args = []) {
    return new Promise(resolve => {
        execFile(process.execPath, [path.join(root, script), ...args], { cwd: dir, env: { ...CLEAN_ENV, ...env } },
            (err, stdout, stderr) => resolve({ code: err ? err.code ?? 1 : 0, out: `${stdout}${stderr}` }));
    });
}
const trackOf = dir => JSON.parse(readFileSync(path.join(dir, 'data/track.json'), 'utf8'));
const raw = dir => readFileSync(path.join(dir, 'data/track.json'), 'utf8');
const YB_ENV = { TRACK_FEED_TYPE: 'yb', TRACK_FEED_URL: 'https://app.yb.tl/milan', TRACK_FEED_API: `${BASE}/APIX/Blog/GetPositions` };
/** the Action's next step: a file that fails the check is never committed */
const checkData = async dir => { const r = await run(dir, {}, "scripts/check-data.mjs", ["data"]); if (r.code) {console.error(r.out);} return r.code === 0; };

const results = [];
async function scenario(name, fn) {
    try {
        await fn();
        results.push(['✓', name]);
    } catch (e) {
        results.push(['✗', name, e.message]);
    }
}

await scenario('F1 no feed set: nothing happens, track.json untouched (updates by hand)', async () => {
    const dir = folder(); const before = raw(dir);
    const r = await run(dir, {});
    assert.equal(r.code, 0);
    assert.equal(raw(dir), before);
});
await scenario('F2 YB: three positions come in, in time order, one per line, the check passes', async () => {
    const dir = folder();
    answer = yb([ybPos(3), ybPos(1), ybPos(2)]);
    const r = await run(dir, YB_ENV);
    assert.equal(r.code, 0, r.out);
    const t = trackOf(dir);
    assert.equal(t.points.length, 3);
    assert.ok(t.points.every((p, i, a) => !i || p.t > a[i - 1].t));
    assert.equal(raw(dir).split('\n').filter(l => l.includes('"t"')).length, 3, 'one position per line');
    assert.ok(/keyword=milan/.test(server.last) && /event=17480/.test(server.last), `asks YB for the right tracker and its event (${server.last})`);
    assert.ok(await checkData(dir));
});
await scenario('F3 YB answers the same again: "No new positions", the file is not touched (no commit)', async () => {
    const dir = folder(); answer = yb([ybPos(1), ybPos(2)]);
    await run(dir, YB_ENV); const before = raw(dir);
    const r = await run(dir, YB_ENV);
    assert.match(r.out, /No new positions/);
    assert.equal(raw(dir), before);
});
await scenario('F4 YB sends old and new together: only the new are added, nothing is ever removed', async () => {
    const dir = folder(); answer = yb([ybPos(1), ybPos(2)]);
    await run(dir, YB_ENV);
    answer = yb([ybPos(2), ybPos(3), ybPos(4)]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points.length, 4);
    answer = yb([]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points.length, 4, 'an empty answer removes nothing');
});
await scenario('F5 YB speeds in km/h (TRACK_FEED_SPEED=kmh): stored in knots', async () => {
    const dir = folder(); answer = yb([ybPos(1, { speed: 18.52 })]);
    await run(dir, { ...YB_ENV, TRACK_FEED_SPEED: 'kmh' });
    assert.equal(trackOf(dir).points[0].sog, 10);
});
await scenario('F6 YB with text times ("datetime") instead of "at"', async () => {
    const dir = folder(); answer = yb([{ datetime: iso(START + 2 * H), lat: 48.2, lng: -2.8, speed: 9 }]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points.length, 1);
});
await scenario('F7 YB sends the same position twice in one answer: stored once', async () => {
    const dir = folder(); answer = yb([ybPos(1), ybPos(1), ybPos(2)]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points.length, 2);
});
await scenario('F8 YB is down (HTTP 500): the run fails, track.json untouched', async () => {
    const dir = folder([{ t: iso(START + H), lat: 48.5, lon: -2.4 }]); const before = raw(dir);
    answer = { status: 500, type: 'text/plain', body: 'oops' };
    const r = await run(dir, YB_ENV);
    assert.notEqual(r.code, 0);
    assert.equal(raw(dir), before);
});
await scenario('F9 YB answers an HTML page: the run fails, track.json untouched', async () => {
    const dir = folder(); const before = raw(dir);
    answer = { status: 200, type: 'text/html', body: '<html><body>Maintenance</body></html>' };
    assert.notEqual((await run(dir, YB_ENV)).code, 0);
    assert.equal(raw(dir), before);
});
await scenario('F10 YB rows without a place are skipped, the rest kept', async () => {
    const dir = folder(); answer = yb([ybPos(1, { lat: null }), ybPos(2, { lng: 'x' }), ybPos(3)]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points.length, 1);
});
await scenario('F11 a position from the future (a tracker clock glitch) is skipped, so later real ones still come in', async () => {
    const dir = folder(); answer = yb([ybPos(1), { ...ybPos(2), at: Math.floor((NOW + 30 * H) / 1000) }]);
    await run(dir, YB_ENV);
    answer = yb([ybPos(1), ybPos(3)]);
    await run(dir, YB_ENV);
    const t = trackOf(dir).points.map(p => Date.parse(p.t));
    assert.ok(t.every(x => x < NOW + H), 'nothing from the future is stored');
    assert.ok(t.includes(Math.floor((START + 3 * H) / 1000) * 1000), `the later real position came in (${t.map(iso).join(', ')})`);
});
await scenario('F12 YB link without a tracker name: a clear error', async () => {
    const dir = folder();
    const r = await run(dir, { ...YB_ENV, TRACK_FEED_URL: 'https://app.yb.tl/' });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /TRACK_FEED_URL needs the YB page/);
});
await scenario('F17 YB without TRACK_FEED_EVENT: asks YB for the tracker\'s events and uses the default one', async () => {
    const dir = folder(); answer = yb([ybPos(1)]);
    events = { events: [{ id: 111, name: 'Old', startTime: 1 }, { id: 17480, name: 'All time', default: true, startTime: 0 }] };
    const r = await run(dir, { ...YB_ENV, TRACK_FEED_URL: 'https://my.yb.tl/oceancall/' });
    assert.equal(r.code, 0, r.out);
    assert.ok(/keyword=oceancall/.test(server.lastEvents), server.lastEvents);
    assert.ok(/keyword=oceancall/.test(server.last) && /event=17480/.test(server.last), server.last);
    assert.equal(trackOf(dir).points.length, 1);
    server.lastEvents = '';
    await run(dir, { ...YB_ENV, TRACK_FEED_EVENT: '999' });
    assert.ok(!server.lastEvents && /event=999/.test(server.last), 'TRACK_FEED_EVENT wins, no lookup');
});
await scenario('F18 YB answers {"error": …} (e.g. without an event): the run fails, track.json untouched', async () => {
    const dir = folder([{ t: iso(START + H), lat: 48.5, lon: -2.4 }]); const before = raw(dir);
    answer = { status: 200, type: 'application/json', body: '{"at":1793364793544,"error":"DispatcherException"}' };
    const r = await run(dir, YB_ENV);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /YB answered: DispatcherException/);
    assert.equal(raw(dir), before);
    events = { events: [] };
    const r2 = await run(dir, YB_ENV);
    assert.match(r2.out, /no event/);
    events = { events: [{ id: 17480, name: 'All time', default: true, startTime: 0 }] };
});
await scenario('F19 YB times in milliseconds (as YB sends them) and an empty answer before the tracker reports', async () => {
    const dir = folder(); answer = { status: 200, type: 'application/json', body: '{"drawRanges":[],"positions":[]}' };
    const r = await run(dir, YB_ENV);
    assert.equal(r.code, 0, r.out);
    assert.equal(trackOf(dir).points.length, 0);
    answer = yb([{ ...ybPos(2), at: START + 2 * H }]);
    await run(dir, YB_ENV);
    assert.equal(trackOf(dir).points[0].t, iso(START + 2 * H));
});
await scenario('F13 Garmin inReach (KML): positions with speed in km/h stored in knots', async () => {
    const dir = folder();
    const pm = (h, lat, lon) => `<Placemark><TimeStamp><when>${iso(START + h * H)}</when></TimeStamp><ExtendedData><Data name="Velocity"><value>18.5 km/h</value></Data><Data name="Course"><value>244.0 ° True</value></Data></ExtendedData><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;
    answer = { status: 200, type: 'application/vnd.google-earth.kml+xml', body: `<kml><Document>${pm(1, 48.5, -2.4)}${pm(2, 48.4, -2.6)}</Document></kml>` };
    const r = await run(dir, { TRACK_FEED_TYPE: 'inreach', TRACK_FEED_URL: `${BASE}/Feed/Share/milan` });
    assert.equal(r.code, 0, r.out);
    const t = trackOf(dir);
    assert.equal(t.points.length, 2);
    assert.ok(Math.abs(t.points[0].sog - 10) < 0.1, `sog ${t.points[0].sog}`);
    assert.ok(/d1=/.test(server.last), 'asks only for positions since the last one');
});
await scenario('F14 a plain JSON list of positions', async () => {
    const dir = folder();
    answer = { status: 200, type: 'application/json', body: JSON.stringify([{ t: iso(START + H), lat: 48.5, lon: -2.4, sog: 9 }, { time: iso(START + 2 * H), lat: 48.4, lng: -2.6 }]) };
    const r = await run(dir, { TRACK_FEED_TYPE: 'json', TRACK_FEED_URL: `${BASE}/positions.json` });
    assert.equal(r.code, 0, r.out);
    assert.equal(trackOf(dir).points.length, 2);
});
await scenario('F15 an unknown feed type: a clear error, nothing written', async () => {
    const dir = folder(); const before = raw(dir);
    const r = await run(dir, { TRACK_FEED_TYPE: 'carrier-pigeon', TRACK_FEED_URL: `${BASE}/x` });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /not one of/);
    assert.equal(raw(dir), before);
});
await scenario('F16 the feed password is sent to the feed (and only there)', async () => {
    const dir = folder(); let auth = '';
    const old = server.listeners('request')[0];
    server.removeAllListeners('request');
    server.on('request', (req, res) => { auth = req.headers.authorization || ''; old(req, res); });
    answer = yb([ybPos(1)]);
    await run(dir, { ...YB_ENV, TRACK_FEED_PASSWORD: 's3cret' });
    server.removeAllListeners('request'); server.on('request', old);
    assert.equal(auth, 'Basic ' + Buffer.from(':s3cret').toString('base64'));
    assert.ok(!raw(dir).includes('s3cret'), 'the password never ends up in track.json');
});

await scenario('F20 the first run, days before the start: the last day\'s positions come in (the boat in the harbour)', async () => {
    const early = { ...race, start: { ...race.start, time: iso(NOW + 48 * H) } };
    const dir = folder();
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify(early));
    const at = h => ({ at: NOW + h * H, lat: 48.6458, lng: -2.0247, speed: 0, course: 0 });
    answer = yb([at(-30), at(-2), at(-0.5)]);
    const r = await run(dir, YB_ENV);
    assert.equal(r.code, 0, r.out);
    assert.equal(trackOf(dir).points.length, 2, 'the last day only');
    assert.ok(await checkData(dir));
});

await scenario('F21 YB\'s real answer (my.yb.tl/oceancall, 30 Oct 2026: short names "t" and "g", no speed): read', async () => {
    const early = { ...race, start: { ...race.start, time: iso(NOW + 48 * H) } };
    const dir = folder();
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify(early));
    const at = NOW - 40 * 60e3;
    answer = { status: 200, type: 'application/json;charset=utf-8', body: JSON.stringify({ drawRanges: [{ start: 0, end: 0, event: { colour: '#FF0000', default: true, name: 'All time', id: 17480, isFixed: true } }],
        positions: [{ at, t: 48.64841000000001, g: -2.022529999999989, id: 1280023014 }] }) };
    const r = await run(dir, { ...YB_ENV, TRACK_FEED_URL: 'https://my.yb.tl/oceancall/' });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(trackOf(dir).points, [{ t: iso(at), lat: 48.64841, lon: -2.02253, sog: null, cog: null }]);
    assert.ok(await checkData(dir));
});

// ---- the official tracker (race.json "official"): never ahead of the organisers' map ----
const OFFICIAL_BEFORE = path.join(root, 'scripts/fixtures/official-before-start.json'); // the real answer, 31 Oct 2026
function officialFile(o) {
    const f = path.join(mkdtempSync(path.join(tmpdir(), 'racetrack-official-')), 'official.json');
    writeFileSync(f, JSON.stringify(o));
    return f;
}
const withOfficial = dir => {
    const r = JSON.parse(readFileSync(path.join(dir, 'data/race.json'), 'utf8'));
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify({ ...r, official: { url: `${BASE}/official.html`, boat: '59' } }));
    return dir;
};
const offTrack = hours => ({ id: '59', name: 'Inland Roots, Ocean Soul', state: 'RUNNING', standby: false, start: START,
    points: hours.map(h => ({ t: START + h * H, lat: 48.5 - h * 0.1, lon: -2.4 - h * 0.2 })) });

// The official-map check in scripts/fetch-track.mjs was switched off on 1 Nov 2026 (it is commented out there). While it
// is, its scenarios (F22–F25) are skipped, not failed. They run again as soon as the "// " in front of that block is removed.
const GUARD_ON = /^if \(race\.official\?\.url/m.test(readFileSync(path.join(root, 'scripts/fetch-track.mjs'), 'utf8'));
const guardScenario = async (name, fn) => {
    if (GUARD_ON) {await scenario(name, fn);} else {results.push(['-', `${name}  (skipped: the official-map check is switched off in scripts/fetch-track.mjs)`]);}
};

await guardScenario('F22 official map: positions newer than its newest one wait, and come in once it shows them', async () => {
    const dir = withOfficial(folder());
    answer = yb([ybPos(1), ybPos(2), ybPos(3)]);
    let r = await run(dir, { ...YB_ENV, OFFICIAL_FILE: officialFile(offTrack([0, 1, 2])) });
    assert.equal(r.code, 0, r.out);
    assert.equal(trackOf(dir).points.length, 2, 'the third waits');
    assert.match(r.out, /1 newer position\(s\) wait/);
    r = await run(dir, { ...YB_ENV, OFFICIAL_FILE: officialFile(offTrack([0, 1, 2, 3])) });
    assert.equal(trackOf(dir).points.length, 3, 'now the official map has it too');
    assert.ok(await checkData(dir));
});
await guardScenario('F23 official map before the start (its times still in the future, the real answer of 31 Oct): positions up to now come in', async () => {
    const dir = withOfficial(folder());
    const early = JSON.parse(readFileSync(path.join(dir, 'data/race.json'), 'utf8'));
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify({ ...early, start: { ...early.start, time: iso(NOW + 48 * H) } }));
    answer = yb([{ at: NOW - 30 * 60e3, t: 48.64841, g: -2.02253 }]);
    const r = await run(dir, { ...YB_ENV, OFFICIAL_FILE: OFFICIAL_BEFORE });
    assert.equal(r.code, 0, r.out);
    assert.equal(trackOf(dir).points.length, 1);
    assert.match(r.out, /Inland Roots, Ocean Soul \(boat 59\)/);
});
await guardScenario('F24 official map can\'t be read: the run fails and nothing new is published; OFFICIAL_CHECK=off skips it', async () => {
    const dir = withOfficial(folder()); const before = raw(dir);
    answer = yb([ybPos(1)]);
    const r = await run(dir, { ...YB_ENV, OFFICIAL_FILE: path.join(dir, 'missing.json') });
    assert.notEqual(r.code, 0);
    assert.equal(raw(dir), before);
    const r2 = await run(dir, { ...YB_ENV, OFFICIAL_CHECK: 'off', OFFICIAL_FILE: path.join(dir, 'missing.json') });
    assert.equal(r2.code, 0, r2.out);
    assert.equal(trackOf(dir).points.length, 1);
});
await guardScenario('F25 compares our track with the official one and warns when they\'re far apart', async () => {
    const dir = withOfficial(folder());
    answer = yb([ybPos(1), ybPos(2)]);
    let r = await run(dir, { ...YB_ENV, OFFICIAL_FILE: officialFile(offTrack([1, 2])) });
    assert.match(r.out, /Compared 2 official position\(s\) with ours: at most 0 NM apart/);
    assert.doesNotMatch(r.out, /WARNING/);
    const far = offTrack([1, 2]); far.points[1].lat += 0.5;
    r = await run(withOfficial(folder()), { ...YB_ENV, OFFICIAL_FILE: officialFile(far) });
    assert.match(r.out, /WARNING: our track is 30\.\d+ NM away/);
});
// the real reader: a headless Chrome opens a page with Geovoile's map objects (a stand-in on this computer)
const chrome = process.env.OFFICIAL_CHROME || ['/usr/bin/google-chrome', ...(() => {
    try { return readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => `/opt/pw-browsers/${d}/chrome-linux64/chrome`); } catch { return []; }
})()].find(f => existsSync(f));
await scenario('F26 the real reader in a headless Chrome: finds the boat by its number, or by the sailor\'s name', async () => {
    const page = `<!doctype html><script>setTimeout(() => { window.tracker = { _eventState: 'RUNNING', stateIsStandby: false, timecodeOfficialStart: ${START / 1000},
        _boats: [{ id: 7, name: 'Someone else', sailors: [{ fname: 'A', lname: 'B' }], track: { locations: [] } },
                 { id: 59, name: 'Inland Roots, Ocean Soul', sailors: [{ fname: 'Milan', lname: 'Kolacek' }],
                   track: { locations: [{ timecode: ${START / 1000 + 3600}, lat: 48.1, lng: -3.1 }, { timecode: ${START / 1000 + 7200}, lat: 47.9, lng: -3.6 }] } }] }; }, 300);</script>`;
    const old = server.listeners('request')[0];
    server.removeAllListeners('request');
    server.on('request', (req, res) => { if (req.url.startsWith('/official.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); } else {old(req, res);} });
    try {
        const { readOfficial } = await import(path.join(root, 'scripts/official.mjs'));
        process.env.OFFICIAL_CHROME = chrome || '';
        delete process.env.OFFICIAL_FILE;
        let o = await readOfficial({ url: `${BASE}/official.html`, boat: '59' }, 'Milan Koláček');
        assert.equal(o.name, 'Inland Roots, Ocean Soul');
        assert.deepEqual(o.points.map(p => p.t), [START + H, START + 2 * H]);
        o = await readOfficial({ url: `${BASE}/official.html` }, 'Milan Koláček');
        assert.equal(o.id, '59', 'found by name (with or without the accents)');
        await assert.rejects(readOfficial({ url: `${BASE}/official.html`, boat: '12345' }, 'Nobody Here'), /boat not found/);
    } finally {
        server.removeAllListeners('request'); server.on('request', old);
    }
});

// ---- YouTube: new videos from a playlist or channel → data/videos.json (scripts/fetch-videos.mjs) ----
// a stand-in YouTube: the feed (as YouTube writes it), a channel page for @handles, and /shorts/<id> (200 for a Short)
let ytFeed = '', ytStatus = 200; const shorts = new Set(); const ytAsked = [];
const ytEntry = (id, title, date, short = false) => `<entry><id>yt:video:${id}</id><yt:videoId>${id}</yt:videoId><yt:channelId>UCabcdefghijklmnopqrstuv</yt:channelId><title>${title}</title><link rel="alternate" href="https://www.youtube.com/${short ? `shorts/${id}` : `watch?v=${id}`}"/><author><name>Milan</name></author><published>${date}</published><updated>${date}</updated><media:group><media:title>${title}</media:title></media:group></entry>`;
const ytXml = entries => `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><title>Milan</title>${entries.join('')}</feed>`;
function youtube(req, res) {
    ytAsked.push(req.url);
    if (req.url.startsWith('/yt/feeds/videos.xml')) { res.writeHead(ytStatus, { 'content-type': 'application/atom+xml' }); res.end(ytStatus === 200 ? ytFeed : 'nope'); return true; }
    if (req.url.startsWith('/yt/@')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"></html>'); return true; }
    if (req.url.startsWith('/yt/shorts/')) { const id = req.url.split('/').pop(); if (shorts.has(id)) { res.writeHead(200); } else { res.writeHead(303, { location: `/watch?v=${id}` }); } res.end(); return true; }
    return false;
}
{
    const old = server.listeners('request')[0];
    server.removeAllListeners('request');
    server.on('request', (req, res) => { if (!youtube(req, res)) {old(req, res);} });
}
const YT_ENV = { YOUTUBE_BASE: `${BASE}/yt` };
const runVideos = (dir, env = {}) => run(dir, { ...YT_ENV, ...env }, 'scripts/fetch-videos.mjs', ['data/videos.json']);
const withYoutube = (dir, youtube) => {
    const r = JSON.parse(readFileSync(path.join(dir, 'data/race.json'), 'utf8'));
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify({ ...r, youtube }));
    return dir;
};
const vids = dir => JSON.parse(readFileSync(path.join(dir, 'data/videos.json'), 'utf8')).videos;

await scenario('F27 no YouTube playlist or channel in race.json: nothing happens', async () => {
    const dir = folder();
    const r = await runVideos(dir);
    assert.equal(r.code, 0, r.out);
    assert.ok(!existsSync(path.join(dir, 'data/videos.json')));
});
await scenario('F28 a playlist: new videos come in newest first, Shorts upright, nothing from long before the start; the same again changes nothing', async () => {
    const dir = withYoutube(folder(), { playlist: 'PLmilan123' });
    ytFeed = ytXml([ytEntry('aqz-KE-bpKQ', 'Day 3: the first big low', iso(NOW - 5 * H)), ytEntry('jNQXAC9IVRw', 'Reefing &amp; a cup of tea', iso(NOW - 2 * H), true),
        ytEntry('dQw4w9WgXcQ', 'Last year in the boatyard', iso(START - 40 * 24 * H))]);
    let r = await runVideos(dir);
    assert.equal(r.code, 0, r.out);
    assert.ok(ytAsked.some(u => u.includes('playlist_id=PLmilan123')));
    assert.deepEqual(vids(dir).map(v => [v.url, v.vertical, v.title]), [['https://www.youtube.com/shorts/jNQXAC9IVRw', true, 'Reefing & a cup of tea'], ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', false, 'Day 3: the first big low']]);
    assert.ok(await checkData(dir), 'the data check accepts it');
    const before = readFileSync(path.join(dir, 'data/videos.json'), 'utf8');
    r = await runVideos(dir);
    assert.match(r.out, /No new videos/);
    assert.equal(readFileSync(path.join(dir, 'data/videos.json'), 'utf8'), before, 'untouched: no commit');
});
await scenario('F29 a channel by its @handle; a Short the feed links as a normal video is found by asking youtube.com/shorts/', async () => {
    const dir = withYoutube(folder(), { channel: '@milankolacek' });
    ytFeed = ytXml([ytEntry('jNQXAC9IVRw', 'Upright, posted as a normal video', iso(NOW - H))]);
    shorts.add('jNQXAC9IVRw');
    const r = await runVideos(dir);
    shorts.clear();
    assert.equal(r.code, 0, r.out);
    assert.ok(ytAsked.some(u => u.includes('channel_id=UCabcdefghijklmnopqrstuv')), 'the channel id from its page');
    assert.equal(vids(dir)[0].vertical, true);
});
await scenario('F30 YouTube down or the playlist gone: the step fails, videos.json untouched (positions still go out)', async () => {
    const dir = withYoutube(folder(), { playlist: 'PLmilan123' });
    ytFeed = ytXml([ytEntry('aqz-KE-bpKQ', 'One', iso(NOW - H))]);
    await runVideos(dir);
    const before = readFileSync(path.join(dir, 'data/videos.json'), 'utf8');
    ytStatus = 404;
    const r = await runVideos(dir);
    ytStatus = 200;
    assert.notEqual(r.code, 0);
    assert.equal(readFileSync(path.join(dir, 'data/videos.json'), 'utf8'), before);
});

await scenario('F31 the real playlist (Milan Koláček at Route du Rhum 2026, its feed on 31 Oct): its video, wide', async () => {
    const dir = withYoutube(folder(), { playlist: 'PLKGh7_gk-WF8' });
    const early = JSON.parse(readFileSync(path.join(dir, 'data/race.json'), 'utf8'));
    writeFileSync(path.join(dir, 'data/race.json'), JSON.stringify({ ...early, start: { ...early.start, time: '2026-11-01T12:02:00Z' } }));
    ytFeed = readFileSync(path.join(root, 'scripts/fixtures/youtube-playlist.xml'), 'utf8');
    const r = await runVideos(dir);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(vids(dir), [{ url: 'https://www.youtube.com/watch?v=9OPozTSNank', title: 'What Are Sailors Up Against? Milan Koláček Breaks Down the Route du Rhum 2026 Start Weather', date: '2026-10-31T15:18:53.000Z', vertical: false }]);
});

server.close();
const bad = results.filter(r => r[0] === '✗');
for (const r of results) {console.log(r.join('  '));}
if (bad.length) {
    console.error(`\n${bad.length} of ${results.length} feed scenarios failed`);
    process.exit(1);
}
console.log(`\nall ${results.length} feed scenarios pass`);
