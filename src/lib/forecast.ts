/** Windy's forecast where the boat is: wind (ECMWF) and waves, hour by hour */
import { pointForecast } from './adapters/windy';
import { celsiusFromKelvin } from './units';
import type { PointForecast, PointForecastData } from './adapters/windy';
import type { Hour } from './types';

export const WIND_MODEL = 'ecmwf';
const WAVE_MODELS = ['ecmwfWaves', 'gfsWaves'];
const LIFE = 20 * 60e3;
const cache = new Map<string, { at: number; p: Promise<PointForecast | null> }>();

/** The forecast for the boat's own position (to about 100 m), like Windy's point forecast there */
function getFull(model: string, lat: number, lon: number): Promise<PointForecast | null> {
    const la = Math.round(lat * 1000) / 1000;
    const lo = Math.round(lon * 1000) / 1000;
    const key = `${model}|${la}|${lo}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < LIFE) {return hit.p;}
    const p = pointForecast(model, la, lo).catch(e => {
        console.info(`[racetrack] ${model} not available here`, e);
        cache.delete(key);
        return null;
    });
    cache.set(key, { at: Date.now(), p });
    while (cache.size > 64) {cache.delete(cache.keys().next().value as string);}
    return p;
}
const get = async (model: string, lat: number, lon: number): Promise<PointForecastData | null> => (await getFull(model, lat, lon))?.data ?? null;

const val = (d: PointForecastData | null, col: string, i: number): number | null => {
    const v = d?.[col]?.[i];
    return typeof v === 'number' && isFinite(v) ? v : null;
};
const nearest = (ts: number[], t: number): number => {
    let best = 0;
    for (let i = 1; i < ts.length; i++) {if (Math.abs(ts[i] - t) < Math.abs(ts[best] - t)) {best = i;}}
    return best;
};

/** The forecast at a place from `from` for `hours` hours, one row per `step` hours */
export async function hoursAt(lat: number, lon: number, from = Date.now(), hours = 24, step = 3): Promise<Hour[]> {
    const d = await get(WIND_MODEL, lat, lon);
    if (!d?.ts?.length) {return [];}
    let w: PointForecastData | null = null;
    for (const m of WAVE_MODELS) {
        w = await get(m, lat, lon);
        if (w?.ts?.length && Array.isArray(w.waves) && w.waves.some(x => x !== null)) {break;}
        w = null;
    }
    const out: Hour[] = [];
    const first = Math.floor(from / 3600e3) * 3600e3;
    for (let t = first; t <= first + hours * 3600e3; t += step * 3600e3) {
        const i = nearest(d.ts, t);
        if (Math.abs(d.ts[i] - t) > 3 * 3600e3) {continue;}
        const j = w ? nearest(w.ts, t) : -1;
        const wv = w && Math.abs(w.ts[j] - t) <= 3 * 3600e3 ? w : null;
        out.push({
            ts: d.ts[i],
            wind: val(d, 'wind', i), gust: val(d, 'windGust', i), dir: val(d, 'windDir', i),
            temp: celsiusFromKelvin(val(d, 'temperature', i)), rain: val(d, 'precipAmount', i),
            waves: val(wv, 'waves', j), wavesDir: val(wv, 'wavesDir', j), wavesPeriod: val(wv, 'wavesPeriod', j),
        });
    }
    // the same hour twice (a model with 3-hour steps later on): keep one
    return out.filter((h, k) => k === 0 || h.ts !== out[k - 1].ts);
}

/** Right now at a place */
export async function nowAt(lat: number, lon: number): Promise<Hour | null> {
    return (await hoursAt(lat, lon, Date.now(), 0, 1))[0] ?? null;
}
