// Data scenarios: what racetrack does with the two files it fetches from GitHub, good and bad.
// node scripts/test-fetch.mjs   (part of npm run check; the scenarios are listed in docs/testing.md, section D)
import assert from 'node:assert/strict';
import { loadLib } from './lib.mjs';

// a browser-like localStorage for the "last copy" cache
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const L = await loadLib();
const H = 3600e3;
const NOW = Date.now();
const START = NOW - 30 * H;
const race = {
    athlete: { name: 'Milan Koláček', short: 'Milan', flag: 'CZ', photo: 'milan.jpg', links: [{ label: 'Instagram', url: 'https://www.instagram.com/milan_kolacek/' }] },
    race: { name: 'Route du Rhum 2026', url: 'https://www.routedurhum.com' },
    start: { name: 'Saint-Malo', lat: 48.68, lon: -2.02, time: new Date(START).toISOString() },
    finish: { name: 'Pointe-à-Pitre', lat: 16.22, lon: -61.53 },
    follow: [{ name: 'Windy.com', links: [{ label: 'Instagram', url: 'https://www.instagram.com/windy_forecast/' }] }],
};
const iso = t => new Date(t).toISOString();
const track = { updated: iso(NOW - 5 * 60e3), points: [0, 1, 2, 3].map(i => ({ t: iso(START + (i + 1) * H), lat: 48.5 - i * 0.1, lon: -2.4 - i * 0.2, sog: 9.5, cog: 240 })) };

/** a fake GitHub: answers for race.json and track.json, and counts what was asked */
function serve(answers) {
    const asked = [];
    globalThis.fetch = async (url, opts) => {
        asked.push({ url: String(url), opts });
        const file = /track\.json/.test(String(url)) ? 'track' : 'race';
        const a = answers[file];
        if (a instanceof Error) {throw a;}
        if (typeof a === 'number') {return new Response('Not Found', { status: a, statusText: 'Not Found' });}
        return new Response(typeof a === 'string' ? a : JSON.stringify(a), { status: 200 });
    };
    return asked;
}
const URL_ = 'https://raw.githubusercontent.com/svqs/Race-Tracker-for-Windy.com/main/data/race.json';
const results = [];
async function scenario(name, fn) {
    store.clear();
    try {
        await fn();
        results.push(['✓', name]);
    } catch (e) {
        results.push(['✗', name, e.message]);
    }
}

// --- D1–D9: loading both files (src/lib/source.ts) ---
await scenario('D1 both files fine: race and 4 positions, and a copy kept for next time', async () => {
    const asked = serve({ race, track });
    const l = await L.loadRace(URL_);
    assert.equal(l.race.athlete.name, 'Milan Koláček');
    assert.equal(l.track.points.length, 4);
    assert.equal(asked[1].url.split('?')[0], URL_.replace('race.json', 'track.json'), 'track.json is read next to race.json');
    assert.ok(/[?&]v=\d+/.test(asked[0].url), 'GitHub cache-busting parameter');
    assert.equal(asked[0].opts.credentials, 'omit', 'no cookies to GitHub');
    assert.ok(L.lastLoaded(), 'the last copy is kept');
});
await scenario('D2 GitHub is down (race.json 503): an error, so the last copy stays on screen', async () => {
    serve({ race: 503, track });
    await assert.rejects(L.loadRace(URL_));
});
await scenario('D3 offline (fetch fails): an error; the copy from an earlier visit is still there', async () => {
    serve({ race, track });
    await L.loadRace(URL_);
    serve({ race: new TypeError('Failed to fetch'), track });
    await assert.rejects(L.loadRace(URL_));
    assert.equal(L.lastLoaded()?.track.points.length, 4, 'the earlier copy');
});
await scenario('D4 race.json is an HTML page (GitHub error page): an error, nothing replaced', async () => {
    serve({ race: '<!DOCTYPE html><html>404</html>', track });
    await assert.rejects(L.loadRace(URL_));
});
await scenario('D5 race.json without a start or a finish: an error that says so', async () => {
    serve({ race: { ...race, finish: undefined }, track });
    await assert.rejects(L.loadRace(URL_), /athlete, the start or the finish/);
});
await scenario('D6 before the start, no track.json yet (404): fine, no positions', async () => {
    serve({ race: { ...race, start: { ...race.start, time: iso(NOW + 48 * H) } }, track: 404 });
    const l = await L.loadRace(URL_);
    assert.equal(l.track.points.length, 0);
});
await scenario('D7 after the start, track.json missing (404): an error, the last copy stays', async () => {
    serve({ race, track: 404 });
    await assert.rejects(L.loadRace(URL_));
});
await scenario('D8 track.json cut off half way (not JSON): an error, the last copy stays', async () => {
    serve({ race, track: '{"points": [ {"t": "2026-11-0' });
    await assert.rejects(L.loadRace(URL_));
});
await scenario('D9 a broken copy in the browser storage is ignored', async () => {
    store.set('racetrack-last', '{"race": 12, "track": "x"');
    assert.equal(L.lastLoaded(), null);
    store.set('racetrack-last', JSON.stringify({ race: { nonsense: true }, track: track, at: 1 }));
    assert.equal(L.lastLoaded(), null);
});

// --- D10–D19: what's in the files (src/lib/data.ts) ---
await scenario('D10 positions out of order, twice, from the future, a 400-knot glitch, bad rows: only good ones, in order', async () => {
    const p = track.points;
    const messy = { points: [p[3], p[1], { ...p[1] }, p[0], p[2],
        { t: iso(NOW + 5 * H), lat: 45, lon: -5 },                                // the future
        { t: iso(START + 2.5 * H), lat: 10, lon: 20, sog: 400 },                  // a jump no boat makes
        { t: 'yesterday-ish', lat: 48, lon: -2 }, { t: iso(START + 3.2 * H), lat: null, lon: -2 }, { t: iso(START + 3.4 * H), lat: 123, lon: -2 }] };
    const t = L.readTrack(messy, NOW);
    assert.equal(t.points.length, 4);
    assert.ok(t.points.every((x, i, a) => !i || x.t > a[i - 1].t), 'in time order');
});
await scenario('D11 times as seconds, milliseconds or text; lng instead of lon; [t, lat, lon] rows', async () => {
    const t = L.readTrack({ points: [{ t: Math.floor((START + H) / 1000), lat: 48, lng: -2 }, { time: START + 2 * H, lat: 47.9, lon: -2.1 }, [iso(START + 3 * H), 47.8, -2.2]] }, NOW);
    assert.equal(t.points.length, 3);
});
await scenario('D12 no speed or course in the file: worked out from the positions', async () => {
    const pts = track.points.map(({ t, lat, lon }) => ({ t, lat, lon }));
    const st = L.raceState(L.readRace(race), L.readTrack({ points: pts }, NOW), NOW);
    assert.ok(st.speed > 0 && st.course !== null, `speed ${st.speed}, course ${st.course}`);
});
await scenario('D13 speeds that make no sense (negative, 90 knots) are left out, not shown', async () => {
    const t = L.readTrack({ points: [{ t: iso(START + H), lat: 48, lon: -2, sog: -3 }, { t: iso(START + 2 * H), lat: 47.9, lon: -2.1, sog: 90 }] }, NOW);
    assert.ok(t.points.every(p => p.sog === null));
});
await scenario('D14 20,000+ positions: read in well under a second, capped at 20,000, the newest kept', async () => {
    const big = { points: Array.from({ length: 25000 }, (_, i) => ({ t: iso(START + i * 60e3 - 400 * H), lat: 48 - i * 1e-4, lon: -2 - i * 1e-4 })) };
    const t0 = performance.now();
    const t = L.readTrack(big, NOW);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `${Math.round(ms)} ms`);
    assert.ok(t.points.length <= 20000);
    assert.equal(t.points.at(-1).t, Date.parse(big.points.at(-1).t), 'the newest position is kept');
});
await scenario('D15 links: only https, the main website first, names from the address', async () => {
    const r = L.readRace({ ...race, athlete: { ...race.athlete, url: 'https://milankolacek.eu', links: ['https://www.facebook.com/milankolacekracing', { label: 'x', url: 'http://insecure.example' }, { url: 'javascript:alert(1)' }] } });
    assert.deepEqual(r.athlete.links.map(l => l.label), ['', 'Facebook']);
});
await scenario('D16 photos: a file name or https only; a javascript: or http: address is dropped', async () => {
    assert.equal(L.readRace({ ...race, athlete: { ...race.athlete, photo: 'javascript:alert(1)' } }).athlete.photo, '');
    assert.equal(L.readRace({ ...race, athlete: { ...race.athlete, photo: 'http://x.example/a.jpg' } }).athlete.photo, '');
    assert.equal(L.readRace({ ...race, athlete: { ...race.athlete, photo: '../milan.jpg' } }).athlete.photo, '../milan.jpg');
});
await scenario('D17 "follow" (Windy.com…): kept with its links; entries without a name or links dropped', async () => {
    const r = L.readRace({ ...race, follow: [...race.follow, { name: 'No links' }, { links: ['https://a.example'] }] });
    assert.deepEqual(r.follow.map(f => f.name), ['Windy.com']);
});
await scenario('D25 "watch" (things to look out for): only Windy layers racetrack knows, with a line; per phase; the defaults otherwise', async () => {
    const r = L.readRace({ ...race, watch: [
        { layer: 'pressure', text: 'A big low crosses on Tuesday.' }, { layer: 'currentsTide', text: 'Huge tides at {short}’s start.', phase: 'before' },
        { layer: 'nukes', text: 'x' }, { layer: 'waves' }, { layer: 'pressure', text: 'twice' }, { layer: 'wind', text: '<b>bold</b>'.repeat(40) },
    ] });
    assert.deepEqual(r.watch.map(x => x.layer), ['pressure', 'currentsTide', 'wind'], 'unknown layers, no line and repeats dropped');
    assert.ok(r.watch[2].text.length <= 160, 'lines are capped');
    const before = L.watchList(r.watch, 'before', 'Milan');
    assert.deepEqual(before.map(x => x.layer), ['wind', 'waves', 'pressure', 'currentsTide'], 'the phase’s own layers, in their order');
    assert.match(before[3].text, /Huge tides at Milan’s start/, 'race.json’s line replaces racetrack’s');
    assert.match(before[2].text, /big low/);
    const racing = L.watchList([...r.watch, { layer: 'rain', text: 'Squalls near Guadeloupe.' }, { layer: 'pressure', text: 'Only once racing.', phase: 'racing' }], 'racing', 'Milan');
    assert.deepEqual(racing.map(x => x.layer), ['rain', 'wind', 'waves', 'pressure'], 'an added layer comes first; at most 4');
    assert.equal(racing[3].text, 'Only once racing.', 'a line for this phase beats one for every phase');
    assert.deepEqual(L.watchList([], 'before', 'Milan').map(x => x.layer), ['wind', 'waves', 'pressure', 'currentsTide']);
    assert.deepEqual(L.watchList([], 'racing', 'Milan').map(x => x.layer), ['wind', 'waves', 'pressure', 'currents']);
    assert.ok(L.watchList([], 'racing', 'Milan').every(x => x.text && !/watch_|\{/.test(x.text)), 'every default has its words');
    assert.deepEqual(L.readRace(race).watch, []);
});
await scenario('D18 status finished / retired with endTime; anything else is racing', async () => {
    assert.equal(L.readRace({ ...race, status: 'finished', endTime: iso(NOW) }).status, 'finished');
    assert.equal(L.readRace({ ...race, status: 'retired' }).status, 'retired');
    assert.equal(L.readRace({ ...race, status: 'sinking' }).status, 'racing');
});
await scenario('D19 the track file name can\'t point to a script', async () => {
    assert.equal(L.readRace({ ...race, track: 'javascript:alert(1)' }).track, 'track.json');
});

// --- D20–D24: the race over time (src/lib/race.ts) ---
const R = L.readRace(race);
const T = L.readTrack(track, NOW);
await scenario('D20 racing: the last position, its age, not quiet', async () => {
    const st = L.raceState(R, T, START + 4 * H + 10 * 60e3);
    assert.equal(st.phase, 'racing');
    assert.equal(st.age, 10 * 60e3);
    assert.equal(st.quiet, false);
});
await scenario('D21 quiet: no position for 3 hours (exactly 3 h is still fine)', async () => {
    assert.equal(L.raceState(R, T, START + 7 * H).quiet, false);
    assert.equal(L.raceState(R, T, START + 7 * H + 60e3).quiet, true);
});
await scenario('D22 started, no position yet: racing, nothing to show for the boat', async () => {
    const st = L.raceState(R, L.readTrack({ points: [] }), START + H);
    assert.equal(st.phase, 'racing');
    assert.equal(st.last, null);
});
await scenario('D23 before the start: the countdown phase, the whole course to go', async () => {
    const st = L.raceState(R, L.readTrack({ points: [] }), START - H);
    assert.equal(st.phase, 'before');
    assert.ok(st.toFinish > 6000, `${Math.round(st.toFinish)} km`);
});
await scenario('D24 finished / retired: no live speed, the race time', async () => {
    for (const status of ['finished', 'retired']) {
        const st = L.raceState({ ...R, status, endTime: START + 4 * H }, T, NOW);
        assert.equal(st.phase, status);
        assert.equal(st.speed, null);
        assert.equal(st.elapsed, 4 * H);
    }
});

const bad = results.filter(r => r[0] === '✗');
for (const r of results) {console.log(r.join('  '));}
if (bad.length) {
    console.error(`\n${bad.length} of ${results.length} data scenarios failed`);
    process.exit(1);
}
console.log(`\nall ${results.length} data scenarios pass`);
