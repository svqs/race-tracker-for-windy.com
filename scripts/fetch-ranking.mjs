// Milan's ranking from the official race tracker → data/ranking.json (run by the update-track workflow on every run,
// so it comes in with every new position). The plugin shows it; the file is optional.
//
// The organisers' map (race.json "official", Geovoile) publishes a report about once an hour: every boat's rank in its
// class, its distance to the finish and to the leader. Its plain /data/versions.txt says when the last report came
// out, so this only opens the map (headless Chrome, like scripts/official.mjs) when there is a new report.
// RANKING_FILE (tests) reads the map's answer from a file instead of opening the map.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = process.argv[2] || 'data/ranking.json';
const race = JSON.parse(readFileSync('data/race.json', 'utf8'));
const cfg = race.official;
if (!cfg?.url) {
    console.log('No official tracker in race.json ("official"): no ranking.');
    process.exit(0);
}
const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};

/** the map's own note of when its last report came out ("reports:20261102140439"), cheap to read */
async function reportsVersion() {
    if (process.env.RANKING_FILE) return process.env.RANKING_VERSION || String(Date.now());
    const u = new URL(cfg.versions || '../data/versions.txt', cfg.url);
    u.searchParams.set('v', String(Date.now()));
    const r = await fetch(u, { signal: AbortSignal.timeout(20e3), headers: { 'user-agent': 'racetrack-windy-plugin (github action)' } });
    if (!r.ok) throw new Error(`the official map's versions.txt answered ${r.status}`);
    const m = (await r.text()).match(/reports\s*:\s*(\d+)/);
    if (!m) throw new Error('the official map\'s versions.txt has no "reports"');
    return m[1];
}

/** runs inside the official map: our boat's line in the current report, and how many boats are ranked in its class */
function inPage({ boat }) {
    const t = window.tracker;
    const rep = t && t.currentReport;
    if (!rep || !Array.isArray(rep.lines) || !rep.lines.length || !t._boatsByIds) return null;
    const line = rep.lines.find(l => String(l.boat) === String(boat));
    if (!line) return { error: `boat ${boat} isn't in the report` };
    const cls = t._boatClassesByBoatIds && t._boatClassesByBoatIds[line.boat];
    const same = rep.lines.filter(l => cls && t._boatClassesByBoatIds[l.boat] === cls);
    return {
        rank: Number(line.rank) || null, of: same.length || null, class: cls ? cls.name : '', status: String(line.racestatus || ''),
        at: Number(rep.timecode) * 1000 || null, dtf: Number(line.dtf) || null, dtl: Number(line.dtl) || null,
        leader: (() => { const l = same.find(x => Number(x.rank) === 1); return l && t._boatsByIds[l.boat] ? t._boatsByIds[l.boat].name : ''; })(),
    };
}

async function readMap() {
    if (process.env.RANKING_FILE) return JSON.parse(readFileSync(process.env.RANKING_FILE, 'utf8'));
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright-core');
    const exe = process.env.OFFICIAL_CHROME;
    const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
    try {
        const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (racetrack-windy-plugin; github action) Chrome' });
        await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 60e3 });
        const h = await page.waitForFunction(inPage, { boat: cfg.boat || '' }, { timeout: 60e3, polling: 1000 });
        return await h.jsonValue();
    } finally {
        await browser.close();
    }
}

const version = await reportsVersion();
if (old.version === version) {
    console.log(`Ranking: no new official report (${old.rank ?? '–'} of ${old.of ?? '–'} in ${old.class || 'the class'}).`);
    process.exit(0);
}
const r = await readMap();
if (r.error) throw new Error(`the official map: ${r.error}`);
if (!Number.isInteger(r.rank) || r.rank < 1 || !Number.isInteger(r.of) || r.rank > r.of) throw new Error(`the official map's ranking makes no sense: ${JSON.stringify(r)}`);
const out = {
    rank: r.rank, of: r.of, class: String(r.class || '').slice(0, 40), status: String(r.status || '').slice(0, 10),
    report: r.at ? new Date(r.at).toISOString() : null,
    dtf: r.dtf, dtl: r.dtl, leader: String(r.leader || '').slice(0, 60),
    version, source: cfg.url,
};
writeFileSync(FILE, JSON.stringify(out, null, 4) + '\n');
console.log(`Ranking: ${out.rank} of ${out.of} in ${out.class} (report ${out.report}).`);
