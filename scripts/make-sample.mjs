// Writes a made-up race to data/sample/ (day 4 of the Route du Rhum, last position 11 minutes ago), so the plugin has a
// boat and a track to show while you work on it (npm start runs this). data/sample/ is never published or committed.
//   node scripts/make-sample.mjs            day 4, racing
//   node scripts/make-sample.mjs quiet      no position for 5 hours
//   node scripts/make-sample.mjs finished   across the line
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const scenario = process.argv[2] || 'racing';
const real = JSON.parse(readFileSync(new URL('../data/race.json', import.meta.url), 'utf8'));
const now = Date.now();
const start = scenario === 'finished' ? now - 15.5 * 864e5 : now - 4.3 * 864e5;
const ROUTE = [[48.68, -2.02], [48.78, -2.6], [48.55, -5.4], [46.2, -8.2], [43.4, -10.4], [39.6, -11.8], [34.2, -17.4], [28.6, -21.6], [23.5, -31], [19.6, -43], [17.4, -53], [16.7, -60.4], [16.22, -61.53]];
const rad = d => (d * Math.PI) / 180;
const dist = (a, b) => 2 * 6371 * Math.asin(Math.sqrt(Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2));
const legs = ROUTE.slice(1).map((p, i) => dist(ROUTE[i], p));
const total = legs.reduce((a, b) => a + b, 0);
const along = km => {
    let i = 0;
    while (i < legs.length - 1 && km > legs[i]) { km -= legs[i]; i++; }
    const f = Math.min(1, km / legs[i]);
    return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f];
};
const iso = t => new Date(t).toISOString();
const until = scenario === 'finished' ? start + 14.2 * 864e5 : now - (scenario === 'quiet' ? 5.2 * 3600e3 : 11 * 60e3);
const points = [];
let km = 0;
for (let t = start + 15 * 60e3; t <= until && km < total; t += 15 * 60e3) {
    const h = (t - start) / 3600e3;
    const kn = 9.5 + 2.6 * Math.sin(h / 9) + 1.2 * Math.sin(h / 2.3) + (h > 60 ? 1.5 : 0);
    km += kn * 1.852 * 0.25;
    const [lat, lon] = along(km);
    const side = Math.sin(h / 5.5) * 0.18;
    points.push({ t: iso(t), lat: +(lat + side * 0.6).toFixed(4), lon: +(lon + side).toFixed(4), sog: +kn.toFixed(1), cog: null });
}
const race = {
    ...real,
    start: { ...real.start, time: iso(start) },
    status: scenario === 'finished' ? 'finished' : 'racing',
    endTime: scenario === 'finished' ? points[points.length - 1].t : null,
    source: 'made-up positions (data/sample, only on this computer)',
};
race.athlete = { ...real.athlete, photo: real.athlete.photo ? `../${real.athlete.photo}` : '', background: real.athlete.background ? `../${real.athlete.background}` : '', cover: real.athlete.cover ? `../${real.athlete.cover}` : '', boatPhoto: real.athlete.boatPhoto ? `../${real.athlete.boatPhoto}` : '' };
mkdirSync(new URL('../data/sample/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/sample/race.json', import.meta.url), JSON.stringify(race, null, 4) + '\n');
writeFileSync(new URL('../data/sample/track.json', import.meta.url), `{\n    "updated": "${iso(now)}",\n    "points": [\n${points.map(p => '        ' + JSON.stringify(p)).join(',\n')}\n    ]\n}\n`);
// the real videos (data/videos.json, from Milan's playlist) in the made-up race too, so the video card shows
if (existsSync(new URL('../data/videos.json', import.meta.url))) {copyFileSync(new URL('../data/videos.json', import.meta.url), new URL('../data/sample/videos.json', import.meta.url));}
// and the real rank (data/ranking.json, from the organisers' tracker), so the rank shows while working on it
if (existsSync(new URL('../data/ranking.json', import.meta.url))) {copyFileSync(new URL('../data/ranking.json', import.meta.url), new URL('../data/sample/ranking.json', import.meta.url));}
console.log(`Sample race (${scenario}) in data/sample/: ${points.length} positions, start ${iso(start)}`);
