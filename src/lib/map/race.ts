/** The race on the map: the track, the boat, start and finish, and the line still to go */
import { THEME } from '../theme';
import { greatCircle } from '../geo';
import { escapeHtml } from './html';
import { avatarHtml, flagHtml } from '../athlete';
import type { RaceInfo, TrackPoint } from '../types';

interface Layer { remove(): void }
interface Line extends Layer { getBounds(): unknown }
export interface RaceHost {
    line(points: [number, number][], options: { color: string; weight: number; opacity: number; dashArray?: string }): Line;
    point(lat: number, lon: number, html: string, options?: { click?: () => void; front?: boolean }): Layer;
    fit(points: [number, number][]): void;
}
export interface RaceView {
    race: RaceInfo;
    points: TrackPoint[];
    /** where the dotted line to the finish starts (default: the boat, or the start) */
    courseFrom?: { lat: number; lon: number };
    /** null until there's a position */
    boat: { p: TrackPoint; course: number | null; label: string; quiet: boolean; photo: string; rank?: string; small?: boolean } | null;
    /** a position picked in the track list */
    picked: { p: TrackPoint; label: string } | null;
    showCourse: boolean;
    onBoat: () => void;
}

/**
 * The boat: a black Class40 seen from above (wide scow bow, beam carried aft, flat stern) with a white edge so it shows
 * on dark layers too, turned the way it's sailing (owner's pick "C", 2 Nov). Drawn bow up in a 24 x 48 box.
 */
const HULL = '<svg viewBox="0 0 24 48" aria-hidden="true">'
    + '<path d="M12 2.5C16.6 2.5 20.4 8.6 21.2 16.5L21.4 44.5Q21.4 45.5 20.4 45.5L3.6 45.5Q2.6 45.5 2.6 44.5L2.8 16.5C3.6 8.6 7.4 2.5 12 2.5Z" fill="var(--rt-hullFill, #141414)" stroke="var(--rt-hullEdge, #fff)" stroke-width="1.6"/>'
    + '<path d="M12 6.5C15.2 6.5 17.8 11 18.3 17L18.4 41.5L5.6 41.5L5.7 17C6.2 11 8.8 6.5 12 6.5Z" fill="none" stroke="var(--rt-hullDeck, #5a5f66)" stroke-width="1"/>'
    + '<circle cx="12" cy="19" r="1.6" fill="var(--rt-hullEdge, #fff)"/></svg>';

/**
 * The boat on the map: the hull in a live blue ring (grey when the tracker is quiet or it's over), then a black tag:
 * the athlete's photo, the name, the speed, the rank and the flag (owner, 2 Nov). Phones draw it a little smaller.
 */
export function boatHtml(o: { name: string; fullName?: string; photo: string; flag: string; label: string; course: number | null; quiet: boolean; rank?: string; small?: boolean }): string {
    const turn = o.course === null ? 0 : Math.round(o.course);
    return `<div class="rt-boat${o.quiet ? ' quiet' : ''}${o.small ? ' small' : ''}"><span class="rt-pulse"></span><span class="rt-ring"></span>`
        + `<i class="rt-hull" style="transform:rotate(${turn}deg)">${HULL}</i>`
        + `<span class="rt-tagline">${avatarHtml(o.fullName || o.name, o.photo, 'map')}<b>${escapeHtml(o.name)}</b>${o.label ? `<em>${escapeHtml(o.label)}</em>` : ''}`
        + `${o.rank ? `<i class="rt-rank">${escapeHtml(o.rank)}</i>` : ''}${flagHtml(o.flag, 10)}</span></div>`;
}

export function createRaceLayer(host: RaceHost) {
    let layers: Layer[] = [];
    let pickLayer: Layer | null = null;
    const clear = () => {
        layers.forEach(l => l.remove());
        layers = [];
    };
    return {
        draw(v: RaceView): void {
            clear();
            try {
                const { race } = v;
                const latlngs = v.points.map(p => [p.lat, p.lon] as [number, number]);
                const from = v.courseFrom ?? v.boat?.p ?? race.start;
                if (v.showCourse) {
                    layers.push(host.line(greatCircle(from, race.finish), { color: THEME.courseColor, weight: THEME.courseWidth, opacity: THEME.courseAlpha, dashArray: THEME.courseDash }));
                }
                if (latlngs.length > 1) {
                    layers.push(host.line(latlngs, { color: THEME.casingColor, weight: THEME.routeWidth + THEME.casingWidth * 2, opacity: THEME.casingWidth > 0 ? THEME.casingAlpha : 0 }));
                    layers.push(host.line(latlngs, { color: THEME.routeColor, weight: THEME.routeWidth, opacity: 1 }));
                }
                layers.push(host.point(race.start.lat, race.start.lon, `<div class="rt-dot start"></div><div class="rt-route-label">${escapeHtml(race.start.name)}</div>`));
                layers.push(host.point(race.finish.lat, race.finish.lon, `<div class="rt-dot end"></div><div class="rt-route-label">${escapeHtml(race.finish.name)}</div>`));
                if (v.boat) {
                    layers.push(host.point(v.boat.p.lat, v.boat.p.lon, boatHtml({ name: race.athlete.short, fullName: race.athlete.name, photo: v.boat.photo, flag: race.athlete.flag, label: v.boat.label, course: v.boat.course, quiet: v.boat.quiet, rank: v.boat.rank, small: v.boat.small }), { click: v.onBoat, front: true }));
                }
            } catch (error) {
                console.info('[racetrack] could not draw the race', error);
            }
            this.pick(v.picked);
        },
        /** a small mark for a position picked in the track list */
        pick(picked: RaceView['picked']): void {
            pickLayer?.remove();
            pickLayer = null;
            if (!picked) {return;}
            try {
                pickLayer = host.point(picked.p.lat, picked.p.lon, `<div class="rt-picked"><i></i><span>${escapeHtml(picked.label)}</span></div>`, { front: true });
            } catch (error) {
                console.info('[racetrack] could not mark the position', error);
            }
        },
        /** the whole race in view: the track so far and the finish (before the start: start and finish) */
        fitAll(v: RaceView): void {
            const pts: [number, number][] = v.points.map(p => [p.lat, p.lon]);
            pts.push([v.race.start.lat, v.race.start.lon], [v.race.finish.lat, v.race.finish.lon]);
            if (v.boat) {pts.push([v.boat.p.lat, v.boat.p.lon]);}
            host.fit(pts);
        },
        clear(): void {
            clear();
            pickLayer?.remove();
            pickLayer = null;
        },
    };
}
