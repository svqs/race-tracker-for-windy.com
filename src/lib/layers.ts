/**
 * "Things to look out for" on the Now page: a few of Windy's map layers, each with one plain line about why it matters
 * now. Tapping one switches Windy's map to it (store 'overlay'). The ids are Windy's own overlay names.
 *
 * The lines: racetrack's own for the phase (src/lib/copy.ts, watch… keys: before the start the tides, at sea the ocean
 * currents), and race.json "watch" can change any line or add a layer while the race goes on.
 */
import { w, fill } from './copy';
import type { LayerId, Watch } from './types';
import type { Phase } from './race';

export const LAYERS: ReadonlyArray<LayerId> = ['wind', 'gust', 'waves', 'swell1', 'pressure', 'currents', 'currentsTide', 'rain'];
export const isLayer = (v: unknown): v is LayerId => typeof v === 'string' && (LAYERS as ReadonlyArray<string>).includes(v);

/** the layer's name, as racetrack says it (copy.ts: layer… keys) */
export const layerName = (id: LayerId): string => w(`layer_${id}`);

/** racetrack's own list for the phase */
export function defaultWatch(phase: Phase, short: string): Watch[] {
    const before = phase === 'before';
    const list: LayerId[] = before ? ['wind', 'waves', 'pressure', 'currentsTide'] : ['wind', 'waves', 'pressure', 'currents'];
    const line = (layer: LayerId): string => {
        const k = `watch_${layer}Before`;
        return fill(before && w(k) !== k ? w(k) : w(`watch_${layer}`), { short });
    };
    return list.map(layer => ({ layer, text: line(layer) }));
}

/**
 * What the Now page shows (at most 4): racetrack's own list for the phase, where race.json's lines for this phase
 * replace the line of the same layer; race.json's other layers come first.
 */
export function watchList(own: Watch[], phase: Phase, short: string): Watch[] {
    const now = phase === 'before' ? 'before' : 'racing';
    // a line for this phase beats one for every phase (so those go last, and the last one counts)
    const mine = own.filter(x => !x.phase || x.phase === now).sort((a, b) => Number(!!a.phase) - Number(!!b.phase))
        .map(x => ({ layer: x.layer, text: fill(x.text, { short }) }));
    const pick = (l: LayerId): Watch | undefined => mine.filter(x => x.layer === l).pop();
    const base = defaultWatch(phase, short);
    const extra = mine.filter((x, i) => !base.some(b => b.layer === x.layer) && mine.findIndex(y => y.layer === x.layer) === i).map(x => pick(x.layer) as Watch);
    return [...extra, ...base.map(b => pick(b.layer) ?? b)].slice(0, 4);
}
