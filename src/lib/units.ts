import type { WindUnit, DistUnit, HeightUnit, TempUnit, Settings } from './types';

export const WIND_UNITS: { id: WindUnit; label: string }[] = [
    { id: 'kt', label: 'kt' },
    { id: 'ms', label: 'm/s' },
    { id: 'kmh', label: 'km/h' },
    { id: 'mph', label: 'mph' },
    { id: 'bft', label: 'bft' },
];
export const DIST_UNITS: { id: DistUnit; label: string }[] = [
    { id: 'nm', label: 'nm' },
    { id: 'km', label: 'km' },
    { id: 'mi', label: 'mi' },
];
export const HEIGHT_UNITS: { id: HeightUnit; label: string }[] = [
    { id: 'm', label: 'm' },
    { id: 'ft', label: 'ft' },
];
export const TEMP_UNITS: { id: TempUnit; label: string }[] = [
    { id: 'C', label: '°C' },
    { id: 'F', label: '°F' },
];
export const DEFAULT_SETTINGS: Settings = { wind: 'kt', dist: 'nm', height: 'm', temp: 'C' };

// Beaufort upper limits in m/s for force 0..11 (12 is above the last limit)
const BFT = [0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
export const KNOT = 1 / 1.943844;

export const windLabel = (u: WindUnit): string => WIND_UNITS.find(x => x.id === u)?.label || u;
/** Boat speeds in Beaufort make no sense: they show in knots then */
export const speedUnit = (u: WindUnit): WindUnit => (u === 'bft' ? 'kt' : u);

/** m/s -> display unit (not rounded) */
export const toWind = (ms: number, u: WindUnit): number => {
    switch (u) {
        case 'kt': return ms * 1.943844;
        case 'kmh': return ms * 3.6;
        case 'mph': return ms * 2.236936;
        case 'bft': {
            const i = BFT.findIndex(limit => ms < limit);
            return i === -1 ? 12 : i;
        }
        default: return ms;
    }
};

/** Wind for big tiles: whole numbers */
export const fmtWind0 = (ms: number | null, u: WindUnit): string => (ms === null || !isFinite(ms) ? '–' : `${Math.round(toWind(ms, u))}`);
/** A boat's speed: one decimal (it moves slowly next to the wind) */
export const fmtSpeed = (ms: number | null, u: WindUnit): string => {
    if (ms === null || !isFinite(ms)) {return '–';}
    const v = toWind(ms, speedUnit(u));
    return v >= 100 ? `${Math.round(v)}` : v.toFixed(1);
};

const NM = 1.852;
/** km -> display distance, as a number */
export const toDist = (km: number, u: DistUnit): number => (u === 'nm' ? km / NM : u === 'mi' ? km * 0.621371 : km);
/** Distances: whole numbers with thousands separators ("2,940"), one decimal under 10 */
export const fmtDist = (km: number | null, u: DistUnit): string => {
    if (km === null || !isFinite(km)) {return '–';}
    const v = toDist(km, u);
    return v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString(undefined);
};
export const distLabel = (u: DistUnit): string => DIST_UNITS.find(x => x.id === u)?.label || u;

export const fmtHeight = (m: number | null, u: HeightUnit): string => {
    if (m === null || !isFinite(m)) {return '–';}
    return `${Math.round((u === 'ft' ? m * 3.28084 : m) * 10) / 10}`;
};
export const fmtTemp = (c: number | null, u: TempUnit): string => {
    if (c === null || !isFinite(c)) {return '–';}
    return `${Math.round(u === 'F' ? c * 1.8 + 32 : c)} °${u}`;
};
export const celsiusFromKelvin = (kelvin: number | null): number | null => (kelvin === null ? null : Math.round((kelvin - 273.15) * 10) / 10);

/**
 * The viewer's units, read from Windy (@windy/metrics: what they picked in Windy's settings). Anything Windy doesn't
 * say, or says in a unit racetrack doesn't know, falls back to the default (kt, nm, m, °C).
 */
export function fromWindy(m: Partial<Record<'wind' | 'distance' | 'waves' | 'temp', { metric?: string } | undefined>>): Settings {
    const W: Record<string, WindUnit> = { 'kt': 'kt', 'm/s': 'ms', 'km/h': 'kmh', 'mph': 'mph', 'bft': 'bft' };
    const D: Record<string, DistUnit> = { 'NM': 'nm', 'nm': 'nm', 'km': 'km', 'mi': 'mi', 'sm': 'mi' };
    const H: Record<string, HeightUnit> = { 'm': 'm', 'ft': 'ft' };
    const T: Record<string, TempUnit> = { '°C': 'C', '°F': 'F' };
    return {
        wind: W[m.wind?.metric ?? ''] ?? DEFAULT_SETTINGS.wind,
        dist: D[m.distance?.metric ?? ''] ?? DEFAULT_SETTINGS.dist,
        height: H[m.waves?.metric ?? ''] ?? DEFAULT_SETTINGS.height,
        temp: T[m.temp?.metric ?? ''] ?? DEFAULT_SETTINGS.temp,
    };
}

/** Settings read from storage, every field checked (anything odd falls back to the default) */
export function readSettings(value: unknown): Settings {
    const o = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const pick = <T extends string>(v: unknown, list: { id: T }[], d: T): T => (list.some(x => x.id === v) ? v as T : d);
    return {
        wind: pick(o.wind, WIND_UNITS, DEFAULT_SETTINGS.wind),
        dist: pick(o.dist, DIST_UNITS, DEFAULT_SETTINGS.dist),
        height: pick(o.height, HEIGHT_UNITS, DEFAULT_SETTINGS.height),
        temp: pick(o.temp, TEMP_UNITS, DEFAULT_SETTINGS.temp),
    };
}
