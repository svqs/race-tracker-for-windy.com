import * as wfetch from '@windy/fetch';

export interface PointForecastData { ts: number[]; [column: string]: (number | null)[] }
export interface PointForecast {
    data: PointForecastData;
    summary?: { timestamp: number; predictability: number }[];
    celestial?: { sunriseTs: number; sunsetTs: number };
}
function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
/** Windy is the only untyped boundary. Consumers get finite, aligned columns and a usable time axis. */
export function readPointForecast(value: unknown): PointForecast | null {
    const payload = record(record(value)?.data);
    const raw = record(payload?.data);
    if (!raw || !Array.isArray(raw.ts) || !raw.ts.length || raw.ts.length > 2000
        || !raw.ts.every((time, index, times) => typeof time === 'number' && Number.isFinite(time) && (index === 0 || time > times[index - 1]))) {return null;}
    const ts = raw.ts as number[];
    const data: PointForecastData = { ts };
    Object.entries(raw).forEach(([key, column]) => {
        if (key !== 'ts' && Array.isArray(column)) {data[key] = ts.map((_time, index) => typeof column[index] === 'number' && Number.isFinite(column[index]) ? column[index] : null);}
    });
    const summary = Array.isArray(payload?.summary) ? payload.summary.flatMap(item => {
        const day = record(item);
        return day && typeof day.timestamp === 'number' && Number.isFinite(day.timestamp) && typeof day.predictability === 'number' && Number.isFinite(day.predictability)
            ? [{ timestamp: day.timestamp, predictability: day.predictability }] : [];
    }) : undefined;
    const celestial = record(payload?.celestial);
    return { data, summary, ...(celestial && typeof celestial.sunriseTs === 'number' && Number.isFinite(celestial.sunriseTs)
        && typeof celestial.sunsetTs === 'number' && Number.isFinite(celestial.sunsetTs)
        ? { celestial: { sunriseTs: celestial.sunriseTs, sunsetTs: celestial.sunsetTs } } : {}) };
}
export async function pointForecast(model: string, lat: number, lon: number): Promise<PointForecast | null> {
    const extra = model.endsWith('Waves') ? null : { summary: true, celestial: true };
    const result: unknown = await wfetch.getPointForecastData(model as Parameters<typeof wfetch.getPointForecastData>[0], { lat, lon, step: 1 }, extra);
    return readPointForecast(result);
}
