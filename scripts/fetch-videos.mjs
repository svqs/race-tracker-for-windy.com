// Finds the athlete's new YouTube videos and writes data/videos.json (run by .github/workflows/update-track.yml,
// every 15 minutes). The plugin reads that file next to race.json, so a new video shows up on Find Milan's page
// without editing anything or publishing the plugin.
//
// Where to look, in data/race.json:
//   "youtube": { "playlist": "PL…" }             a playlist (best: only the videos you add to it show)
//   "youtube": { "channel": "UC…" or "@handle" }  every video on a channel
//   optional "since": "2026-10-25T00:00:00Z"     older videos are left out (default: a week before the start)
// It reads YouTube's public feed of the playlist or channel (the newest 15, no key needed). Shorts are marked upright:
// the feed links them as youtube.com/shorts/…, and otherwise youtube.com/shorts/<id> is asked whether it is one.
// The file is only rewritten when the list of videos changed (no commit otherwise).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = process.argv[2] || 'data/videos.json';
const BASE = (process.env.YOUTUBE_BASE || 'https://www.youtube.com').replace(/\/$/, '');
const race = JSON.parse(readFileSync('data/race.json', 'utf8'));
const cfg = race.youtube || {};
if (!cfg.playlist && !cfg.channel) {
    console.log('No YouTube playlist or channel in race.json ("youtube"): videos come from race.json only.');
    process.exit(0);
}
const headers = { 'user-agent': 'racetrack-windy-plugin (github action)', 'accept-language': 'en' };
async function get(u, opts = {}) {
    const r = await fetch(u, { headers, ...opts });
    if (!r.ok) throw new Error(`YouTube answered ${r.status} for ${u}`);
    return r.text();
}
const id11 = s => (/^[\w-]{11}$/.test(s) ? s : '');
const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

/** the channel's id (UC…), also from its @handle (read from the channel's page) */
async function channelId(c) {
    if (/^UC[\w-]{22}$/.test(c)) return c;
    const handle = c.replace(/^https:\/\/(www\.)?youtube\.com\//, '').replace(/^@?/, '@');
    const page = await get(`${BASE}/${encodeURI(handle)}`);
    const m = page.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || page.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/);
    if (!m) throw new Error(`couldn't find the channel ${handle} on YouTube`);
    return m[1];
}

const feed = cfg.playlist
    ? `${BASE}/feeds/videos.xml?playlist_id=${encodeURIComponent(cfg.playlist)}`
    : `${BASE}/feeds/videos.xml?channel_id=${await channelId(String(cfg.channel))}`;
const xml = await get(feed);
if (!/<feed[\s>]/.test(xml)) throw new Error('YouTube\'s feed isn\'t a feed (did the playlist or channel change?)');
const since = Date.parse(cfg.since || '') || Date.parse(race.start.time) - 7 * 864e5;

const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { videos: [] };
const known = new Map((old.videos || []).map(v => [v.url.match(/([\w-]{11})$/)?.[1], v]));

/** is it a Short? youtube.com/shorts/<id> shows a Short, and sends anything else on to the normal page */
async function isShort(id) {
    try {
        const r = await fetch(`${BASE}/shorts/${id}`, { headers, method: 'HEAD', redirect: 'manual' });
        return r.status === 200;
    } catch {
        return false;
    }
}

const videos = [];
for (const entry of xml.split('<entry>').slice(1)) {
    const id = id11(entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || '');
    const date = Date.parse(entry.match(/<published>([^<]+)<\/published>/)?.[1] || '');
    if (!id || !isFinite(date) || date < since) continue;
    const title = unxml(entry.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim().slice(0, 120);
    const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] || '';
    const before = known.get(id);
    const vertical = /\/shorts\//.test(link) || (before ? !!before.vertical : await isShort(id));
    videos.push({ url: vertical ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`, title, date: new Date(date).toISOString(), vertical });
}
videos.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
const list = videos.slice(0, 20);

if (JSON.stringify(list) === JSON.stringify(old.videos || [])) {
    console.log(`No new videos (${list.length}).`);
    process.exit(0);
}
writeFileSync(FILE, JSON.stringify({ updated: new Date().toISOString(), source: feed.replace(BASE, 'https://www.youtube.com'), videos: list }, null, 4) + '\n');
console.log(`Videos: ${list.length} (${list.map(v => `${v.vertical ? 'Short' : 'video'} "${v.title}"`).join(', ') || 'none'}).`);
