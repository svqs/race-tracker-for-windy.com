/**
 * Every phrase racetrack shows, in one place, grouped by screen.
 *
 * In a phrase:
 *   {name}          is filled in by racetrack (a number, a time, the athlete's name…). Keep these as they are.
 *   **words**       shows in bold.
 *   {racetrack}     the plugin's name in a sentence (Race Tracker).
 *
 * Names of the athlete, the race and the places come from data/race.json, not from here.
 */
import { writable } from 'svelte/store';

type Item = [key: string, text: string, note?: string];
export interface CopyGroup { id: string; title: string; items: Item[] }

export const COPY_GROUPS: CopyGroup[] = [
    { id: 'bar', title: 'Bar, tabs and page titles', items: [
        ['wordmark', 'Race Tracker', 'The logo (Bariol Regular)'],
        ['tagLive', 'live'], ['tagSoon', 'soon'], ['tagFinished', 'finished'], ['tagRetired', 'retired'],
        ['tabNow', 'Now'], ['tabTrack', 'Track'], ['tabAbout', 'About'],
        ['titleNow', 'Right now', 'Phone: title of the Now panel'], ['titleTrack', 'The track', 'Phone: title of the Track panel'], ['titleAbout', 'Follow {short}', 'Phone: title of the Follow page'],
        ['actFind', 'Find {short}', 'Button: the Now page, and the map goes to the boat'], ['actFindSub', 'on the map'],
        ['actWhole', 'Whole race'], ['actWholeSub', 'track so far'], ['actWholeBefore', 'The course'], ['actWholeBeforeSub', 'start to finish'],
        ['actAbout', 'Follow {short}', 'Button: their social media, Windy’s, and the race website'], ['actForecast', 'Forecast'], ['actForecastSub', 'Windy, right there'],
        ['close', 'Close'], ['back', 'Back'], ['windyMenu', 'Windy’s menu'],
    ] },
    { id: 'head', title: 'The top card', items: [
        ['statSpeed', 'Speed'], ['statToFinish', 'To finish'], ['statAtSea', 'At sea'], ['statSailed', 'Sailed'], ['statTime', 'Race time'],
        ['statStartsIn', 'Starts in'], ['statDistance', 'Distance'], ['statStart', 'Start'], ['statAverage', 'Average'],
        ['startsIn', 'Starts in {time}'], ['startsAt', '{day}, {clock} from {place}'], ['startsNow', 'Starting any minute'],
        ['finishedIn', 'Finished in {time}'], ['retired', 'Out of the race'],
        ['lastPos', 'Last position {ago}'], ['notStarted', 'The race hasn’t started yet'], ['noPosYet', 'The race has started. {short}’s first position shows up here soon.'], ['lastQuiet', 'The tracker can go quiet for a while at sea. The next position will show up here.'],
        ['agoNow', 'just now'], ['agoMin', '{n} min ago'], ['agoH', '{n} h ago'], ['agoHM', '{h} h {m} min ago'], ['agoD', '{n} days ago'],
        ['loading', 'Loading the race…'],
        ['loadError', 'Couldn’t get the newest positions, showing the ones from {time}.'],
        ['loadErrorEmpty', 'Couldn’t load the race. Check your connection and try again.'],
        ['retry', 'Try again'],
        ['straightLine', 'in a straight line'],
    ] },
    { id: 'now', title: 'Now', items: [
        ['condTitle', 'Conditions right now'], ['condTitleBefore', 'Conditions at the start'],
        ['windTitle', 'Wind where {short} is'], ['windTitleBefore', 'Wind at the start'], ['windSub', 'Right now · {model}'],
        ['fcWind', 'Wind'], ['fcGusts', 'Gusts'], ['fcDirection', 'Direction'], ['fcWaves', 'Waves'], ['fcTemp', 'Temperature'],
        ['fcLoading', 'Loading the forecast…'], ['fcEmpty', 'No forecast here right now.'],
        ['fcMore', 'Next 24 hours'], ['fcLess', 'Less'],
        ['nextNote', 'For the boat’s position now. The boat moves on, so later hours are only a hint.'],
        ['pfTitle', 'Windy’s point forecast', 'The card that opens Windy’s own forecast at the boat'],
        ['pfOpen', 'Below the map, where {short} is. It moves with {short}.'], ['pfOpenPhone', 'Over the map, where {short} is. It moves with {short}.'],
        ['pfOpenBefore', 'Below the map, at the start.'], ['pfOpenBeforePhone', 'Over the map, at the start.'],
        ['pfClosed', 'Hour by hour where {short} is.'], ['pfClosedBefore', 'Hour by hour at the start.'],
        ['pfElsewhere', 'It’s showing another place on the map now.'], ['pfBack', 'Back to {short}'],
        ['pfShow', 'Show'], ['pfHide', 'Hide'],
        ['watchTitle', 'Things to look out for', 'Windy layers with one line each; tap one to see it on the map'],
        ['watchOn', 'On the map'], ['watchShow', 'Show'],
        ['layer_wind', 'Wind'], ['layer_gust', 'Gusts'], ['layer_waves', 'Waves'], ['layer_swell1', 'Swell'],
        ['layer_pressure', 'Pressure'], ['layer_currents', 'Ocean currents'], ['layer_currentsTide', 'Tidal currents'], ['layer_rain', 'Rain and squalls'],
        ['watch_wind', 'What’s pushing {short}: how hard, and from where.'],
        ['watch_windBefore', 'The wind at the start sets the pace for the first hours.'],
        ['watch_gust', 'Sudden stronger wind: the moments that break things on board.'],
        ['watch_waves', 'How rough it is out there. Big waves slow the boat and wear out the sailor.'],
        ['watch_swell1', 'Long waves from far-off storms, rolling under the boat.'],
        ['watch_pressure', 'The highs and lows that shape the route. Lows bring strong wind, highs light wind.'],
        ['watch_currents', 'Ocean currents along the route can help the boat along or hold it back.'],
        ['watch_currentsTide', 'Near the coast the tide pushes the boats around. It matters most right at the start.'],
        ['watch_rain', 'Showers and squalls bring sudden, strong wind shifts.'],
        ['boatTitle', 'The boat'], ['boatSpeed', 'Speed'], ['boatCourse', 'Course'], ['boatAverage', 'Average speed'],
        ['boatSailed', 'Sailed so far'], ['boatPosition', 'Position'],
        ['sail1', 'Upwind'], ['sail2', 'Close reach'], ['sail3', 'Beam reach'], ['sail4', 'Broad reach'], ['sail5', 'Downwind'],
        ['sailAngle', 'Wind {angle}° off his bow'],
        ['waitTitle', 'Waiting for the start'], ['waitText', 'The track shows up here and on the map once {short} is racing.'],
    ] },
    { id: 'track', title: 'Track', items: [
        ['trackIntro', 'Newest first, about one an hour. Tap one to see it on the map.'],
        ['trackEmpty', 'No positions yet. They show up here once the race starts.'],
        ['trackMore', 'Show earlier positions'], ['trackStart', 'Start'],
        ['trackUpdated', 'Track updated {time}'],
    ] },
    { id: 'about', title: 'About', items: [
        ['followWho', 'Follow {short}', 'A heading on the Follow page ({short}: the athlete, or Windy.com…)'], ['followNone', 'No links yet.'],
        ['aboutHim', 'About {short}'], ['aboutRace', 'The race'], ['linkWebsite', 'Website'],
        ['factStart', 'Start'], ['factFinish', 'Finish'], ['factDistance', 'Distance'], ['factBoat', 'Boat'],
        ['factStartValue', '{day}, {clock} · {place}'], ['factDistanceValue', '{dist} in a straight line'],
        ['aboutHow', 'How it works'],
        ['how1', '**The tracker on the boat** sends its position by satellite.'],
        ['how2', '**Every few minutes** the positions are copied into a public file on GitHub.'],
        ['how3', '**{racetrack} reads that file,** so everyone sees the same track. Nobody can change it from here.'],
        ['how4', '**The forecast is Windy’s** for the boat’s latest position.'],
        ['aboutDelay', 'Positions can be 15–30 minutes behind the boat.'],
        ['aboutSource', 'Positions: {source}'],
        ['linkRace', 'Race website'], ['linkAthlete', 'More about {short}'],
        ['aboutRoute', '{start} → {finish}, {dist} in a straight line'],
        ['credits', 'Forecast by ECMWF on Windy. Positions from the race tracker.'],
        ['version', '{racetrack} {version}'],
    ] },
    { id: 'card', title: 'The card on the map', items: [
        ['cardSpeed', 'Speed'], ['cardCourse', 'Course'], ['cardWind', 'Wind'], ['cardToFinish', 'To finish'],
        ['cardLoading', 'Loading…'],
        ['cardDetails', 'Details'], ['cardWhole', 'Whole race'], ['cardForecast', 'Forecast'],
        ['cardPointForecast', 'Windy forecast for this position'],
        ['cardAt', 'Position at {time}'],
        ['markStart', 'Start'], ['markFinish', 'Finish'],
        ['phoneProblem', 'racetrack {version} hit a problem: {message}'],
    ] },
];

/** the wording */
export const COPY: Record<string, string> = Object.fromEntries(COPY_GROUPS.flatMap(g => g.items.map(([k, text]) => [k, text])));
export const words = writable<Record<string, string>>({ ...COPY });

/** a phrase by key, outside the template (map labels, messages) */
export const w = (key: string): string => COPY[key] ?? key;

/** fills {name} placeholders; {racetrack} becomes the plain word */
export function fill(s: string, vars: Record<string, string | number> = {}): string {
    return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : k === 'racetrack' ? 'Race Tracker' : m));
}
export const t = (key: string, vars: Record<string, string | number> = {}): string => fill(w(key), vars);

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** HTML for a phrase: escaped, placeholders filled, **bold**, and the plugin's name in its logo font */
export function rich(s: string, vars: Record<string, string | number> = {}): string {
    const h = esc(s).replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? esc(String(vars[k])) : k === 'racetrack' ? '<span class="rt-brand">Race Tracker</span>' : m));
    return h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
