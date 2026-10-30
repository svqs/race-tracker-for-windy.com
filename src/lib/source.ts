/**
 * Where the race data lives: the public GitHub repository. Everyone who installs the plugin reads the same files;
 * nobody can change them from the plugin.
 *
 * To follow someone else in another race, change data/race.json in the repository (and empty data/track.json).
 * DATA_URL only changes if the repository moves.
 */
import { readRace, readTrack, trackUrl } from './data';
import type { RaceInfo, RaceTrack } from './types';

export const DATA_URL = 'https://raw.githubusercontent.com/svqs/racetrack-Windy.com-plugin/main/data/race.json';
/**
 * While you work on the plugin (npm start, loaded in Windy's developer mode), it reads a made-up race from this
 * computer instead (data/sample/, written fresh by scripts/make-sample.mjs on every npm start), so there is a boat
 * and a track to look at before the real race has any. The build sets this; a published plugin always reads DATA_URL.
 */
const DEV_FLAG: string = '__RACETRACK_DEV__';
const DEV = DEV_FLAG === 'true';
export const DEV_DATA_URL = 'https://localhost:9999/data/sample/race.json';
export const defaultDataUrl = (): string => (DEV ? DEV_DATA_URL : DATA_URL);

// the sample race never mixes with the real one in Windy's storage
const CACHE_KEY = DEV ? 'racetrack-dev-last' : 'racetrack-last';
export interface Loaded { race: RaceInfo; track: RaceTrack; at: number }

/** GitHub keeps files for a few minutes; a new address every 2 minutes asks for a fresh copy */
const fresh = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${Math.floor(Date.now() / 120e3)}`;

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
    const r = await fetch(fresh(url), { cache: 'no-cache', signal, credentials: 'omit' });
    if (!r.ok) {throw new Error(`${r.status} ${r.statusText || ''}`.trim());}
    return r.json();
}

/** Both files from GitHub. Throws when they can't be read, so the last good copy stays on screen. */
export async function loadRace(url = DATA_URL, signal?: AbortSignal): Promise<Loaded> {
    const rawRace = await getJson(url, signal);
    const race = readRace(rawRace);
    if (!race) {throw new Error('race.json is missing the athlete, the start or the finish');}
    let rawTrack: unknown = { points: [] };
    try {
        rawTrack = await getJson(trackUrl(url, race.track), signal);
    } catch (e) {
        // before the start there may be no track file yet: that's fine
        if (Date.now() > race.start.time) {throw e;}
    }
    const at = Date.now();
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ race: rawRace, track: rawTrack, at }));
    } catch {
        /* storage full or blocked: not needed */
    }
    return { race, track: readTrack(rawTrack), at };
}

/** The last copy this browser saw, so the plugin shows something straight away (and offline) */
export function lastLoaded(): Loaded | null {
    try {
        const o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        const race = readRace(o?.race);
        return race ? { race, track: readTrack(o.track), at: typeof o.at === 'number' ? o.at : 0 } : null;
    } catch {
        return null;
    }
}
