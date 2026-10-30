/** What the panel and the map show, worked out from the race and its track */
import { distanceKm, bearing } from './geo';
import type { RaceInfo, RaceTrack, TrackPoint } from './types';

export type Phase = 'before' | 'racing' | 'finished' | 'retired';

export interface RaceState {
    phase: Phase;
    last: TrackPoint | null;
    /** speed over ground, m/s (from the tracker, else from the last two positions) */
    speed: number | null;
    /** course over ground, degrees */
    course: number | null;
    /** in a straight line (great circle), km */
    toFinish: number | null;
    /** along the track, km */
    sailed: number;
    /** since the start (or until the end), ms */
    elapsed: number;
    /** average speed since the start, m/s */
    average: number | null;
    /** how old the last position is, ms */
    age: number | null;
    /** the last position is older than 3 hours */
    quiet: boolean;
}

const QUIET = 3 * 3600e3;

/** Speed and course at each position: the tracker's own, else from the step before */
export function motion(points: TrackPoint[], i: number): { speed: number | null; course: number | null } {
    const p = points[i];
    if (!p) {return { speed: null, course: null };}
    const prev = points[i - 1];
    let speed = p.sog;
    let course = p.cog;
    if (prev && (speed === null || course === null)) {
        const s = (p.t - prev.t) / 1000;
        const km = distanceKm(prev, p);
        if (speed === null && s > 0) {speed = (km * 1000) / s;}
        if (course === null && km > 0.05) {course = bearing(prev, p);}
    }
    return { speed, course };
}

export function raceState(race: RaceInfo, track: RaceTrack, now = Date.now()): RaceState {
    const pts = track.points.filter(p => p.t >= race.start.time - 6 * 3600e3);
    const last = pts[pts.length - 1] || null;
    const phase: Phase = race.status !== 'racing' ? race.status : now < race.start.time && !pts.some(p => p.t >= race.start.time) ? 'before' : 'racing';
    let sailed = 0;
    const racing = pts.filter(p => p.t >= race.start.time);
    for (let i = 1; i < racing.length; i++) {sailed += distanceKm(racing[i - 1], racing[i]);}
    const end = phase === 'finished' || phase === 'retired' ? race.endTime ?? last?.t ?? now : now;
    const elapsed = Math.max(0, end - race.start.time);
    const { speed, course } = motion(pts, pts.length - 1);
    const age = last ? Math.max(0, now - last.t) : null;
    return {
        phase, last,
        speed: phase === 'racing' ? speed : null,
        course: phase === 'racing' ? course : null,
        toFinish: last && phase !== 'finished' ? distanceKm(last, race.finish) : phase === 'finished' ? 0 : distanceKm(race.start, race.finish),
        sailed,
        elapsed,
        average: elapsed > 3600e3 && sailed > 0 ? (sailed * 1000) / (elapsed / 1000) : null,
        age,
        quiet: phase === 'racing' && age !== null && age > QUIET,
    };
}

/** Positions for the list: newest first, about one per `everyMin` minutes so a long race stays readable */
export function thinned(points: TrackPoint[], everyMin = 60): { p: TrackPoint; i: number }[] {
    const out: { p: TrackPoint; i: number }[] = [];
    let lastT = Infinity;
    for (let i = points.length - 1; i >= 0; i--) {
        if (lastT - points[i].t >= everyMin * 60e3 - 60e3) {
            out.push({ p: points[i], i });
            lastT = points[i].t;
        }
    }
    return out;
}

/** "2 d 14 h", "14 h 05 min", "12 min" */
export function fmtDuration(ms: number): string {
    const min = Math.floor(ms / 60e3);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    if (d > 0) {return `${d} d ${h} h`;}
    if (h > 0) {return `${h} h ${String(m).padStart(2, '0')} min`;}
    return `${m} min`;
}

/**
 * How the wind meets the boat (point of sail), from where the wind comes from and where the boat is heading:
 * 1 upwind · 2 close reach · 3 beam reach · 4 broad reach · 5 downwind. Also the angle (0° = wind straight ahead).
 */
export function pointOfSail(windFrom: number | null, course: number | null): { level: number; angle: number } | null {
    if (windFrom === null || course === null || !isFinite(windFrom) || !isFinite(course)) {return null;}
    const angle = Math.abs((((windFrom - course) % 360) + 540) % 360 - 180);
    const level = angle < 50 ? 1 : angle < 80 ? 2 : angle < 110 ? 3 : angle < 150 ? 4 : 5;
    return { level, angle: Math.round(angle) };
}
