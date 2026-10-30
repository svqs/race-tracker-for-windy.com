// Feed scenarios: the GitHub Action's reader (scripts/fetch-track.mjs) against a fake tracker on this computer.
// node scripts/test-feed.mjs   (part of npm run check; the scenarios are listed in docs/testing.md, section F)
// Each scenario runs the real script in a fresh folder with a copy of data/race.json and a track.json, the way the
// Action does, then checks track.json (and runs scripts/check-data.mjs on it, like the Action before committing).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const server = createServer((req, res) => {
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
    assert.ok(/keyword=milan/.test(server.last), `asks YB for the right tracker (${server.last})`);
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

server.close();
const bad = results.filter(r => r[0] === '✗');
for (const r of results) {console.log(r.join('  '));}
if (bad.length) {
    console.error(`\n${bad.length} of ${results.length} feed scenarios failed`);
    process.exit(1);
}
console.log(`\nall ${results.length} feed scenarios pass`);
