// Checks the data files before they go live: node scripts/check-data.mjs data
// The GitHub Action runs this after every update, so a broken file never replaces a good one.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLib } from './lib.mjs';

const dir = process.argv[2] || 'data';
const lib = await loadLib();
const { readRace, readTrack } = lib;
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
// data/videos.json (found on YouTube by the update-track Action) is optional; when it's there it must be readable
if (existsSync(path.join(dir, 'videos.json'))) {
    const raw = json('videos.json');
    if (!Array.isArray(raw?.videos)) fail('videos.json needs a "videos" list (it may be empty)');
    const ok = lib.readVideos(raw.videos);
    if (raw.videos.length && !ok.length) fail(`none of the ${raw.videos.length} videos in videos.json is a YouTube video`);
    console.log(`✓ ${ok.length} videos from YouTube${ok.length ? `, newest "${ok[0].title}"` : ''}`);
}
