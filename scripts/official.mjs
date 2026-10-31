// The race's official tracker (race.json "official"): what it shows for our boat, so racetrack never shows more.
//
// The organisers' map (Route du Rhum 2026: Geovoile, https://carto.routedurhum.com/en/index.html) loads its positions
// in its own encoded files, so this opens the map in a headless Chrome and reads, from the map itself, our boat's
// official track: [{ t (ms), lat, lon }]. Checked on 31 Oct 2026: Milan is boat 59, "Inland Roots, Ocean Soul";
// before the start the map shows every boat in Saint-Malo with times at the start.
//
// Used by fetch-track.mjs:
//   gate()     keeps only positions the official map already shows: not newer than its newest position for our boat
//              (before the start, when its times are still in the future, up to now)
//   compare()  our positions next to the official ones at the same times: how far apart, for the run's log
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const KM_NM = 1.852;
const km = (a, b) => {
    const r = Math.PI / 180;
    const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** runs inside the official map: our boat's track, read from Geovoile's own objects (window.tracker) */
function inPage({ boat, sailor }) {
    const t = window.tracker;
    if (!t || !Array.isArray(t._boats) || !t._boats.length) return null;
    const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const b = t._boats.find(x => boat && String(x.id) === String(boat))
        || t._boats.find(x => sailor && (x.sailors || []).some(s => fold(`${s.fname} ${s.lname}`) === sailor || fold(s.lname) === sailor.split(' ').pop()));
    if (!b) return { error: 'boat not found', boats: t._boats.length };
    const locs = (b.track && b.track.locations) || [];
    return {
        id: String(b.id), name: b.name, state: t._eventState, standby: !!t.stateIsStandby,
        start: Number(t.timecodeOfficialStart) * 1000 || null,
        points: locs.map(l => ({ t: Number(l.timecode) * 1000, lat: Number(l.lat), lon: Number(l.lng) }))
            .filter(p => isFinite(p.t) && isFinite(p.lat) && isFinite(p.lon)),
    };
}

/**
 * Our boat on the official map. OFFICIAL_FILE (tests) reads the same answer from a file instead.
 * Throws when the map can't be read: then nothing new is published (racetrack never gets ahead of the official map).
 */
export async function readOfficial(cfg, athleteName) {
    if (process.env.OFFICIAL_FILE) return JSON.parse(readFileSync(process.env.OFFICIAL_FILE, 'utf8'));
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright-core');
    const exe = process.env.OFFICIAL_CHROME;
    // GitHub's runners have Google Chrome; elsewhere, OFFICIAL_CHROME points to a Chrome or Chromium
    const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
    try {
        const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (racetrack-windy-plugin; github action) Chrome' });
        await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 60e3 });
        const arg = { boat: cfg.boat || '', sailor: fold(athleteName) };
        const handle = await page.waitForFunction(inPage, arg, { timeout: 60e3, polling: 1000 });
        const out = await handle.jsonValue();
        if (out.error) throw new Error(`the official map: ${out.error} (${out.boats} boats)`);
        return out;
    } finally {
        await browser.close();
    }
}

/** the newest time racetrack may show: the official map's newest position for our boat; before the start (its
 * times still in the future) up to now */
export function officialUntil(official, now = Date.now()) {
    const last = Math.max(...official.points.map(p => p.t), -Infinity);
    if (!isFinite(last)) return null;
    return Math.min(last, now);
}

/** our positions, without the ones newer than the official map shows */
export function gate(points, official, now = Date.now()) {
    const until = officialUntil(official, now);
    if (until === null) return { kept: [], held: points.length, until: null };
    const kept = points.filter(p => Date.parse(p.t) <= until);
    return { kept, held: points.length - kept.length, until };
}

/** our positions next to the official ones (after the start), at about the same time (within `withinMin` minutes) */
export function compare(ours, official, now = Date.now(), withinMin = 10) {
    const start = official.start ?? -Infinity;
    const theirs = official.points.filter(p => p.t >= start && p.t <= now);
    const mine = ours.map(p => ({ t: Date.parse(p.t), lat: p.lat, lon: p.lon }));
    const rows = [];
    for (const o of theirs) {
        let best = null;
        for (const m of mine) if (!best || Math.abs(m.t - o.t) < Math.abs(best.t - o.t)) best = m;
        if (best && Math.abs(best.t - o.t) <= withinMin * 60e3) rows.push({ t: o.t, minutes: Math.round((best.t - o.t) / 60e3), nm: +(km(best, o) / KM_NM).toFixed(2) });
    }
    const worst = rows.reduce((a, r) => (r.nm > a ? r.nm : a), 0);
    const lastOfficial = Math.max(...theirs.map(p => p.t), -Infinity);
    const lastOurs = Math.max(...mine.map(p => p.t), -Infinity);
    return { compared: rows.length, official: theirs.length, worstNm: worst, rows,
        lastOfficial: isFinite(lastOfficial) ? lastOfficial : null, lastOurs: isFinite(lastOurs) ? lastOurs : null };
}
