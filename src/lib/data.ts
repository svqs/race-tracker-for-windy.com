/**
 * Reading the two data files from the GitHub repository (data/race.json and data/track.json).
 * Everything that comes from outside is checked here: anything odd is dropped, never shown.
 */
import { KNOT } from './units';
import { isLayer } from './layers';
import type { RaceInfo, RaceTrack, TrackPoint, Place, Link, LayerId } from './types';

const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : null);
/** ISO text ("2026-11-01T12:02:00Z") or a number (seconds or milliseconds since 1970) */
export function readTime(v: unknown): number | null {
    if (typeof v === 'number' && isFinite(v)) {return v < 1e11 ? v * 1000 : v;}
    if (typeof v === 'string' && v.trim()) {
        const t = Date.parse(v.trim());
        return isFinite(t) ? t : null;
    }
    return null;
}
const latOk = (v: number | null): v is number => v !== null && v >= -90 && v <= 90;
const lonOk = (v: number | null): v is number => v !== null && v >= -180 && v <= 180;

function readPlace(v: unknown): Place | null {
    const o = rec(v);
    const lat = num(o?.lat);
    const lon = num(o?.lon ?? o?.lng);
    return o && latOk(lat) && lonOk(lon) ? { name: str(o.name, 80), lat, lon } : null;
}

/** race.json → RaceInfo, or null when the file can't be used (no start, finish or name) */
export function readRace(value: unknown): RaceInfo | null {
    const o = rec(value);
    const a = rec(o?.athlete);
    const r = rec(o?.race);
    const start = readPlace(o?.start);
    const startTime = readTime(rec(o?.start)?.time);
    const finish = readPlace(o?.finish);
    const name = str(a?.name, 80);
    if (!o || !name || !start || startTime === null || !finish) {return null;}
    const status = o.status === 'finished' || o.status === 'retired' ? o.status : 'racing';
    const track = str(o.track, 300);
    return {
        athlete: {
            name, short: str(a?.short, 30) || name.split(' ')[0], boat: str(a?.boat, 60), boatName: str(a?.boatName, 60),
            country: str(a?.country, 40), url: safeUrl(a?.url),
            flag: /^[A-Za-z]{2}$/.test(str(a?.flag, 10)) ? str(a?.flag, 2).toUpperCase() : '', photo: safePhoto(a?.photo), background: safePhoto(a?.background), cover: safePhoto(a?.cover), boatPhoto: safePhoto(a?.boatPhoto),
            // "about" at the top of the file is the athlete's (the first race.json had it there)
            about: str(a?.about, 1200) || str(o.about, 1200), links: readLinks(a?.links, a?.url),
        },
        race: { name: str(r?.name, 120), short: str(r?.short, 60) || str(r?.name, 60), url: safeUrl(r?.url), about: str(r?.about, 1200), links: readLinks(r?.links, r?.url) },
        start: { ...start, time: startTime },
        finish,
        status,
        endTime: readTime(o.endTime),
        // others to follow on the athlete's page (a sponsor, the race organiser…): [{ "name": "Windy.com", "links": [...] }]
        follow: (Array.isArray(o.follow) ? o.follow : []).slice(0, 4).map(f => ({ name: str(rec(f)?.name, 40), links: readLinks(rec(f)?.links, null) })).filter(f => f.name && f.links.length),
        // "Things to look out for": [{ "layer": "pressure", "text": "A big low crosses on Tuesday." }]
        // (optional "phase": "before" or "racing": only then)
        watch: (Array.isArray(o.watch) ? o.watch : []).slice(0, 12).map(x => {
            const ph = str(rec(x)?.phase, 10);
            return { layer: str(rec(x)?.layer, 20) as LayerId, text: str(rec(x)?.text, 160), ...(ph === 'before' || ph === 'racing' ? { phase: ph as 'before' | 'racing' } : {}) };
        }).filter((x, i, all) => isLayer(x.layer) && x.text && all.findIndex(y => y.layer === x.layer && y.phase === x.phase) === i),
        // videos (YouTube, watch / youtu.be / shorts / embed / live links): "videos": [{ "url", "title", "date" }], newest first
        videos: readVideos(o.videos ?? (o.video ? [o.video] : [])),
        source: str(o.source, 400),
        track: track && !/^(javascript|data):/i.test(track) ? track : 'track.json',
    };
}

/** the 11-character id of a YouTube video, from any of its usual links (or the id itself) */
export function youtubeId(v: unknown): string {
    const s = str(v, 300).trim();
    if (/^[\w-]{11}$/.test(s)) {return s;}
    let u: URL;
    try {
        u = new URL(s);
    } catch {
        return '';
    }
    if (u.protocol !== 'https:' || !/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(u.hostname)) {return '';}
    const id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] || '';
    return /^[\w-]{11}$/.test(id) ? id : '';
}
export function readVideos(v: unknown): RaceInfo['videos'] {
    return (Array.isArray(v) ? v : []).slice(0, 20).map(x => {
        const r: Record<string, unknown> = rec(x) ?? { url: x };
        const url = str(r.url, 300);
        const id = youtubeId(url || r.id);
        return { id, vertical: r.vertical === true || /\/shorts\//.test(url), title: str(r.title, 120), date: readTime(r.date) };
    }).filter((x, i, a) => x.id && a.findIndex(y => y.id === x.id) === i)
        .sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

/**
 * data/videos.json (written by the update-track Action from a YouTube playlist or channel) added to race.json's own
 * videos: one list, newest first; race.json wins for a video that's in both (its title, upright or not)
 */
export function withVideos(race: RaceInfo, raw: unknown): RaceInfo {
    const auto = readVideos(rec(raw)?.videos);
    if (!auto.length) {return race;}
    const all = [...race.videos, ...auto.filter(a => !race.videos.some(v => v.id === a.id))].sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    return { ...race, videos: all.slice(0, 20) };
}

/** A photo: a file next to race.json, an https address, or (for the sandbox) a picture written into the file */
function safePhoto(v: unknown): string {
    const s = str(v, 200000);
    if (/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(s)) {return s;}
    if (s.length > 300) {return '';}
    return /^https:\/\/[^\s"'<>]+$/i.test(s) || /^(\.\.\/)?\w[\w.\-/]*\.(jpe?g|png|webp)$/i.test(s) ? s : '';
}

/** Names for links people usually add, from the address ("instagram.com" → "Instagram") */
const KNOWN: [RegExp, string][] = [
    [/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)facebook\.com$/, 'Facebook'], [/(^|\.)(x|twitter)\.com$/, 'X'],
    [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'YouTube'], [/(^|\.)linkedin\.com$/, 'LinkedIn'], [/(^|\.)tiktok\.com$/, 'TikTok'],
    [/(^|\.)strava\.com$/, 'Strava'],
];
export function linkLabel(url: string): string {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        return KNOWN.find(([re]) => re.test(host))?.[1] || host;
    } catch {
        return url;
    }
}
/** Links: [{ "label": "Instagram", "url": "https://…" }] or plain addresses; the main website (url) comes first */
function readLinks(v: unknown, main: unknown): Link[] {
    const out: Link[] = [];
    const add = (label: string, url: string) => {
        if (url && !out.some(l => l.url === url) && out.length < 8) {out.push({ label: label || linkLabel(url), url });}
    };
    const m = safeUrl(main);
    // the main website gets its name from the wording ("Website"), so its label stays empty
    if (m) {out.push({ label: '', url: m });}
    for (const item of Array.isArray(v) ? v : []) {
        const o = rec(item);
        add(str(o?.label, 40), safeUrl(o ? o.url : item));
    }
    return out;
}

/** Only plain web links are opened */
function safeUrl(v: unknown): string {
    const s = str(v, 300);
    return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
}

/** Faster than this between two positions is a glitch in the tracker, not a boat (50 knots) */
const MAX_SPEED = 50 * KNOT;

/**
 * track.json → positions in time order. A position needs a time and a place; speed (knots in the file)
 * and course are optional. Duplicates, positions from the future and jumps no boat could make are dropped.
 */
export function readTrack(value: unknown, now = Date.now()): RaceTrack {
    const o = rec(value);
    const list = Array.isArray(o?.points) ? o.points : Array.isArray(value) ? value : [];
    const raw: TrackPoint[] = [];
    // a very long track keeps its newest 20,000 positions (the file is in time order)
    for (const item of list.length > 20000 ? list.slice(-20000) : list) {
        const p = rec(item);
        const arr = Array.isArray(item) ? item : null;
        const t = readTime(p ? p.t ?? p.time : arr?.[0]);
        const lat = num(p ? p.lat : arr?.[1]);
        const lon = num(p ? p.lon ?? p.lng : arr?.[2]);
        if (t === null || !latOk(lat) || !lonOk(lon) || t > now + 3600e3) {continue;}
        const sog = num(p ? p.sog ?? p.speed : arr?.[3]);
        const cog = num(p ? p.cog ?? p.course ?? p.heading : arr?.[4]);
        raw.push({ t, lat, lon, sog: sog !== null && sog >= 0 && sog < 60 ? sog * KNOT : null, cog: cog !== null && cog >= 0 && cog <= 360 ? cog % 360 : null });
    }
    raw.sort((a, b) => a.t - b.t);
    const points: TrackPoint[] = [];
    for (const p of raw) {
        const prev = points[points.length - 1];
        if (prev && p.t - prev.t < 30e3) {continue;} // same position twice
        if (prev) {
            const km = haversine(prev, p);
            const s = (p.t - prev.t) / 1000;
            if ((km * 1000) / s > MAX_SPEED && km > 5) {continue;}
        }
        points.push(p);
    }
    return { updated: readTime(o?.updated), points };
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const r = (d: number) => (d * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A file's address next to race.json (the track, the photo), unless it's a full address already */
export function trackUrl(raceUrl: string, track: string): string {
    if (/^(https:\/\/|data:)/i.test(track)) {return track;}
    try {
        return new URL(track, raceUrl).toString();
    } catch {
        return raceUrl.replace(/[^/]*$/, '') + track;
    }
}
