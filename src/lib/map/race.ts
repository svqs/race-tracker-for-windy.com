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
    /** null before the start */
    boat: { p: TrackPoint; course: number | null; label: string; quiet: boolean; photo: string } | null;
    /** a position picked in the track list */
    picked: { p: TrackPoint; label: string } | null;
    showCourse: boolean;
    onBoat: () => void;
}

/**
 * The heading, like Google Maps: a soft beam fanning out from the photo the way the boat is going (it fades out,
 * no arrow). It takes the ring's colour: live blue while the boat is sending positions, grey when it isn't.
 */
const BEAM = '<svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><defs><radialGradient id="rt-beam-g" cx="56" cy="56" r="54" gradientUnits="userSpaceOnUse">'
    + '<stop offset="0.3" stop-color="currentColor" stop-opacity="0.85"/><stop offset="0.7" stop-color="currentColor" stop-opacity="0.4"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>'
    + '<path d="M56 56 L25 11.8 A54 54 0 0 1 87 11.8 Z" fill="url(#rt-beam-g)"/></svg>';

/** The boat on the map: the athlete's photo in a live ring, the heading as a beam, the name with the flag and the speed */
export function boatHtml(o: { name: string; fullName?: string; photo: string; flag: string; label: string; course: number | null; quiet: boolean }): string {
    const beam = o.course === null ? '' : `<i class="rt-beam" style="transform:rotate(${Math.round(o.course)}deg)">${BEAM}</i>`;
    return `<div class="rt-boat${o.quiet ? ' quiet' : ''}">${beam}<span class="rt-pulse"></span>${avatarHtml(o.fullName || o.name, o.photo, 'map')}`
        + `<span class="rt-tagline">${flagHtml(o.flag, 10)}<b>${escapeHtml(o.name)}</b>${o.label ? `<em>${escapeHtml(o.label)}</em>` : ''}</span></div>`;
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
                const from = v.boat?.p ?? race.start;
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
                    layers.push(host.point(v.boat.p.lat, v.boat.p.lon, boatHtml({ name: race.athlete.short, fullName: race.athlete.name, photo: v.boat.photo, flag: race.athlete.flag, label: v.boat.label, course: v.boat.course, quiet: v.boat.quiet }), { click: v.onBoat, front: true }));
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
            host.fit(pts);
        },
        clear(): void {
            clear();
            pickLayer?.remove();
            pickLayer = null;
        },
    };
}
