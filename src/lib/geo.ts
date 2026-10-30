const R = 6371.0088; // mean Earth radius, km
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees 0–360 (0 = north) */
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return (deg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Points along the great circle from a to b (the shortest way on the globe), so the "to the finish" line
 * bends on the map like the real shortest route does.
 */
export function greatCircle(a: { lat: number; lon: number }, b: { lat: number; lon: number }, steps = 48): [number, number][] {
    const d = distanceKm(a, b) / R;
    if (d < 1e-6) {return [[a.lat, a.lon], [b.lat, b.lon]];}
    const out: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon));
        const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon));
        const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
        out.push([deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))]);
    }
    return out;
}

/** "48°39.2′ N  2°01.6′ W": how sailors write a position */
export function fmtPosition(lat: number, lon: number): string {
    const part = (v: number, pos: string, neg: string) => {
        const a = Math.abs(v);
        const d = Math.floor(a);
        const m = (a - d) * 60;
        return `${d}°${m.toFixed(1).padStart(4, '0')}′ ${v >= 0 ? pos : neg}`;
    };
    return `${part(lat, 'N', 'S')}  ${part(lon, 'E', 'W')}`;
}

/** Degrees to one of 16 compass names */
export const dirName = (d: number | null): string => {
    if (d === null || !isFinite(d)) {return '–';}
    const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return names[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
};
