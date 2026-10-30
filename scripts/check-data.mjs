// Checks the data files before they go live: node scripts/check-data.mjs data
// The GitHub Action runs this after every update, so a broken file never replaces a good one.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLib } from './lib.mjs';

const dir = process.argv[2] || 'data';
const { readRace, readTrack } = await loadLib();
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
const json = file => { try { return JSON.parse(readFileSync(path.join(dir, file), 'utf8')); } catch (e) { fail(`${file} is not valid JSON: ${e.message}`); } };

const rawRace = json('race.json');
const race = readRace(rawRace);
if (!race) fail('race.json needs athlete.name, start {name, lat, lon, time} and finish {name, lat, lon}');
const rawTrack = json(race.track.startsWith('https://') ? 'track.json' : race.track);
const given = Array.isArray(rawTrack?.points) ? rawTrack.points.length : -1;
if (given < 0) fail('track.json needs a "points" list (it may be empty)');
const track = readTrack(rawTrack);
const dropped = given - track.points.length;
if (given > 0 && track.points.length === 0) fail(`none of the ${given} positions in track.json can be used`);
console.log(`✓ ${race.athlete.name}, ${race.race.name || 'race'}: start ${new Date(race.start.time).toISOString()} from ${race.start.name}, finish ${race.finish.name}`);
console.log(`✓ ${track.points.length} positions${dropped ? ` (${dropped} dropped: no time or place, duplicates, or impossible jumps)` : ''}${track.points.length ? `, last ${new Date(track.points.at(-1).t).toISOString()}` : ''}`);
