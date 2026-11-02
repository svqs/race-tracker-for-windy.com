/**
 * racetrack's look: every colour, shape and map mark in one place, the same tokens as spotlog's Style Lab
 * (so the two plugins look like siblings). They become CSS variables --rt-<token>.
 */
export const THEME = {
    // the track on the map, the boat and the line to the finish
    // owner, 30 Oct: the track black (cooler with Windy's colours), with a faint light edge so it still shows on dark layers
    routeColor: '#141414', routeWidth: 2.5, casingColor: '#ffffff', casingWidth: 1, casingAlpha: 0.35,
    courseColor: '#f8f8f8', courseWidth: 1.5, courseAlpha: 0.75, courseDash: '2 7',
    // the start green, the finish blue (owner, 30 Oct)
    startFill: '#3fb950', startBorder: '#f8f8f8', endFill: '#2f6fe4', endBorder: '#f8f8f8', routeLabel: '#f8f8f8',
    // highlights follow Windy's CSS guide: @color-orange (#d49500) for UI elements, @color-orange-light for icons on dark
    // the boat on the map: a live blue ring, pulse and heading beam (like Google Maps); grey when the tracker is quiet or it's over
    boatLive: '#3b8bff', boatStale: '#9aa0a6',
    // the boat itself: a black Class40 hull with a white edge (owner's pick, 2 Nov); desktop 20 x 40 px, phones 16 x 32
    hullFill: '#141414', hullEdge: '#ffffff', hullDeck: '#5a5f66',
    // the tag next to the boat (flag, name, speed): black (owner, 30 Oct)
    boatBg: '#141414', boatText: '#f8f8f8', highlight: '#d49500', highlightLight: '#ffe3a1',
    pickBg: '#2e2e2e', pickText: '#f8f8f8',
    // the rank (organisers' tracker): a soft orange pill next to the name, light orange in the map tag (owner, 2 Nov)
    rankText: '#ffd27a', rankBg: 'rgba(212, 149, 0, 0.18)', rankLine: 'rgba(212, 149, 0, 0.6)',
    // the card on the map
    popupBg: '#f8f8f8', popupText: '#1c1c1c', popupSub: '#6b6b6b', popupBtnBg: '#ececea', popupBtnText: '#1c1c1c', popupLink: '#b07a00',
    // panel and actions
    accent: '#d49500', primaryBg: '#d49500', primaryText: '#ffffff', dangerText: '#ff9a9a',
    selBg: '#d49500', selText: '#ffffff', liveBg: '#50b450', liveText: '#ffffff', quietBg: '#d49500',
    // the forecast card: Windy's dark content (docs.windy-plugins.com/styles: @color-gray-dark bg, @color-gray-light text,
    // @color-gray lines, @color-orange for UI elements, @color-orange-light for icons)
    condBg: '#4d4d4d', condLine: '#6b6b6b', condText: '#e5e5e5', condSub: 'rgba(229, 229, 229, 0.62)', condChip: '#d49500', condChipText: '#ffffff', condIcon: '#ffe3a1',
    uGround: '#2e2e2e', uCard: '#3c3c3c', uLine: '#4d4d4d', uText: '#f8f8f8', uSub: '#b0b0b0',
    uOutline: '#5a5a5a', uInk: '#1c1c1c', uQuiet: '#7a7a7a', uHoverBg: '#424242', uHoverLine: '#777777', star: '#d49500',
    // big action buttons
    actBg: '#3c3c3c', actLine: '#5a5a5a', actText: '#f8f8f8', actSub: '#b0b0b0', actIcon: '#f8f8f8',
    ghostLine: '#5a5a5a', ghostText: '#f8f8f8', linkText: '#d49500',
    // tabs, switches between options, chips
    tabsBg: '#3c3c3c', tabText: '#d0d0d0', chipLine: '#5a5a5a', chipText: '#f8f8f8', chipOnBg: '#f8f8f8', chipOnText: '#1c1c1c',
    switchOff: '#5a5a5a', switchKnob: '#f8f8f8', switchOn: '#d49500',
    // light cards (the forecast card)
    lightBg: '#f8f8f8', lightText: '#1c1c1c', lightSub: '#6b6b6b', lightLine: '#e5e5e5',
    dirTile: '#e9e8e3', wavesTile: '#dbe6f2', boatTile: '#ffe1ec', modelBg: '#d49500', modelText: '#ffffff',
    windNone: 'transparent',
    windText: '#1c1c1c',
    // shapes and type (px)
    radiusCard: 18, radiusButton: 12, radiusChip: 18, radiusSmall: 9, textSize: 14, titleSize: 17, wordmarkSize: 24, panelGap: 16,
};
export type Theme = typeof THEME;
const PX = new Set(['radiusCard', 'radiusButton', 'radiusChip', 'radiusSmall', 'textSize', 'titleSize', 'wordmarkSize', 'panelGap']);

/** CSS variables for the panel and the map marks (the map marks live outside the panel, so they go on :root) */
export const themeCss = (): string => {
    const v: Record<string, string | number> = {};
    for (const [k, x] of Object.entries(THEME)) {v[k] = typeof x === 'number' && PX.has(k) ? `${x}px` : x;}
    return `:root{${Object.entries(v).map(([k, x]) => `--rt-${k}:${x}`).join(';')}}`;
};

/**
 * Windy's wind colours (m/s → colour), measured from Windy's own point forecast on "Wind":
 * white when calm, light blue, cyan, green, yellow, orange, red, then magenta in a gale.
 */
const WIND_STOPS: [number, string][] = [
    [0, '#ffffff'], [2, '#f4f4f4'], [3, '#c4e8f6'], [4, '#8edbf7'], [4.5, '#5fccf4'], [5, '#5fd0db'], [5.5, '#67dfa5'],
    [6, '#6ae646'], [7, '#6de545'], [8, '#7adf43'], [8.5, '#98d240'], [9, '#afc93f'], [9.5, '#c3c23e'], [10, '#e3b63d'],
    [10.5, '#f3ac3c'], [11, '#f2a33b'], [12, '#ef8d36'], [13, '#ee7c36'], [13.5, '#ed6f38'], [14, '#ec6340'], [15, '#eb524d'],
    [16, '#eb4560'], [17, '#ea3c74'], [18, '#ea3688'], [19, '#ea3492'], [20, '#e93395'], [24, '#e63399'], [30, '#c13cae'], [40, '#8c45b8'],
];
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** The colour behind a wind value, blended between Windy's steps */
export const windColor = (ms: number | null): string => {
    if (ms === null || !isFinite(ms)) {return `var(--rt-windNone, ${THEME.windNone})`;}
    const v = Math.max(0, ms);
    let k = WIND_STOPS.findIndex(([m]) => m > v);
    if (k === -1) {return WIND_STOPS[WIND_STOPS.length - 1][1];}
    if (k === 0) {k = 1;}
    const [m0, c0] = WIND_STOPS[k - 1];
    const [m1, c1] = WIND_STOPS[k];
    const f = (v - m0) / (m1 - m0);
    const a = rgb(c0);
    const b = rgb(c1);
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * f)).join(', ')})`;
};
