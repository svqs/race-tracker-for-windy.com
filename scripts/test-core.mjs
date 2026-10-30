// Unit checks for reading the data and working out the race: node scripts/test-core.mjs
import assert from 'node:assert/strict';
import { loadLib } from './lib.mjs';

const L = await loadLib();
const start = Date.parse('2026-11-01T12:02:00Z');
const raceJson = { athlete: { name: 'Milan Koláček' }, start: { name: 'Saint-Malo', lat: 48.68, lon: -2.02, time: '2026-11-01T12:02:00Z' }, finish: { name: 'Pointe-à-Pitre', lat: 16.22, lon: -61.53 } };

// race.json
const race = L.readRace(raceJson);
assert.equal(race.athlete.short, 'Milan', 'short name from the first name');
assert.equal(race.start.time, start);
assert.equal(race.track, 'track.json');
assert.equal(race.status, 'racing');
assert.equal(L.readRace({ ...raceJson, finish: null }), null, 'no finish: unusable');
assert.equal(L.readRace({ ...raceJson, athlete: {} }), null, 'no name: unusable');
assert.equal(L.readRace({ ...raceJson, race: { url: 'javascript:alert(1)' } }).race.url, '', 'only https links');
assert.equal(L.readRace({ ...raceJson, track: 'javascript:x' }).track, 'track.json');
const withPhoto = L.readRace({ ...raceJson, athlete: { name: 'Milan Koláček', flag: 'cz', photo: 'milan.jpg' } });
assert.equal(withPhoto.athlete.flag, 'CZ');
assert.equal(withPhoto.athlete.photo, 'milan.jpg');
assert.equal(L.trackUrl('https://raw.githubusercontent.com/a/b/main/data/race.json', 'milan.jpg'), 'https://raw.githubusercontent.com/a/b/main/data/milan.jpg');
assert.equal(L.readRace({ ...raceJson, athlete: { name: 'X', photo: 'javascript:alert(1)' } }).athlete.photo, '', 'no script photos');
assert.equal(L.readRace({ ...raceJson, athlete: { name: 'X', photo: '"><img src=x onerror=alert(1)>.jpg' } }).athlete.photo, '', 'no HTML in photo names');
assert.equal(L.readRace({ ...raceJson, athlete: { name: 'X', flag: 'Czechia' } }).athlete.flag, '', 'flag is a two-letter code');
const linked = L.readRace({ ...raceJson, about: 'old place', athlete: { name: 'X', url: 'https://milan.example', links: ['https://www.instagram.com/x', { label: 'Blog', url: 'https://blog.example' }, { url: 'http://insecure.example' }, 'https://milan.example'] } });
assert.deepEqual(linked.athlete.links, [{ label: '', url: 'https://milan.example' }, { label: 'Instagram', url: 'https://www.instagram.com/x' }, { label: 'Blog', url: 'https://blog.example' }], 'website first, names from addresses, only https, no repeats');
assert.equal(linked.athlete.about, 'old place', 'about at the top of the file still shows');

// track.json: knots in, m/s inside; bad points out; sorted
const h = 3600e3;
const pts = [
    { t: new Date(start + 2 * h).toISOString(), lat: 48.5, lon: -3.5, sog: 10, cog: 270 },
    { t: new Date(start + 1 * h).toISOString(), lat: 48.7, lon: -2.3, sog: 9 },
    { t: new Date(start + 1 * h + 10e3).toISOString(), lat: 48.7, lon: -2.3 }, // the same position again
    { t: new Date(start + 3 * h).toISOString(), lat: 30, lon: -40 }, // a jump no boat makes
    { t: 'yesterday', lat: 1, lon: 1 },
    { t: new Date(start + 4 * h).toISOString(), lat: 95, lon: 1 },
    [start / 1000 + 3 * 3600, 48.4, -4.6, 11, null], // short form, seconds
];
const track = L.readTrack({ updated: '2026-11-01T16:00:00Z', points: pts }, start + 5 * h);
assert.equal(track.points.length, 3);
assert.ok(track.points.every((p, i, a) => !i || p.t > a[i - 1].t), 'time order');
assert.ok(Math.abs(track.points[0].sog - 9 / 1.943844) < 1e-9, 'knots to m/s');
assert.equal(L.readTrack({ points: [{ t: new Date(start + 48 * h).toISOString(), lat: 1, lon: 1 }] }, start).points.length, 0, 'no positions from the future');
assert.deepEqual(L.readTrack(null).points, []);

// the race
const before = L.raceState(race, { updated: null, points: [] }, start - 3 * 864e5);
assert.equal(before.phase, 'before');
assert.ok(Math.abs(L.toDist(before.toFinish, 'nm') - 3476) < 15, `Saint-Malo to Pointe-à-Pitre is about 3,476 nm (${L.toDist(before.toFinish, 'nm')})`);
const now = start + 3 * h + 20 * 60e3;
const st = L.raceState(race, track, now);
assert.equal(st.phase, 'racing');
assert.equal(st.last.lat, 48.4);
assert.ok(Math.abs(st.speed - 11 / 1.943844) < 1e-9, 'speed from the tracker');
assert.ok(st.course > 230 && st.course < 300, `course from the last two positions (${st.course})`);
assert.equal(st.age, 20 * 60e3);
assert.equal(st.quiet, false);
assert.equal(L.raceState(race, track, now + 4 * h).quiet, true, 'quiet after 3 hours');
assert.ok(st.sailed > 100 && st.sailed < 250, `sailed along the track (${st.sailed} km)`);
const done = L.raceState({ ...race, status: 'finished', endTime: start + 3 * h }, track, now + 864e5);
assert.equal(done.phase, 'finished');
assert.equal(done.speed, null);
assert.equal(done.elapsed, 3 * h);

// list, units, places
assert.deepEqual(L.thinned(track.points, 60).map(x => x.i), [2, 1, 0]);
assert.equal(L.fmtDist(1852 * 2.5, 'nm'), (2500).toLocaleString());
assert.equal(L.fmtDist(9, 'km'), '9.0');
assert.equal(L.fmtSpeed(5, 'bft'), (5 * 1.943844).toFixed(1), 'boat speed in Beaufort shows knots');
assert.equal(L.dirName(225), 'SW');
assert.equal(L.fmtPosition(48.65, -2.03), '48°39.0′ N  2°01.8′ W');
assert.equal(L.trackUrl('https://raw.githubusercontent.com/a/b/main/data/race.json', 'track.json'), 'https://raw.githubusercontent.com/a/b/main/data/track.json');
assert.deepEqual(L.readSettings({ wind: 'ms', dist: 'parsec' }), { wind: 'ms', dist: 'nm', height: 'm', temp: 'C' });
assert.deepEqual(L.fromWindy({ wind: { metric: 'km/h' }, distance: { metric: 'km' }, waves: { metric: 'ft' }, temp: { metric: '°F' } }), { wind: 'kmh', dist: 'km', height: 'ft', temp: 'F' });
assert.deepEqual(L.fromWindy({}), { wind: 'kt', dist: 'nm', height: 'm', temp: 'C' });
const gc = L.greatCircle(race.start, race.finish, 10);
assert.equal(gc.length, 11);
assert.ok(gc[5][0] > (48.68 + 16.22) / 2, 'the shortest way bends north');
console.log('core checks pass');
