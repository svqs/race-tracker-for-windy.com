# Race Tracker (racetrack): how the whole plugin works

For anyone reviewing or testing racetrack (people or agents). Read this first, then [AGENTS.md](../AGENTS.md) for the
ground rules, [data.md](data.md) for the data files and [testing.md](testing.md) for the tests.

## What it is

Race Tracker is a Windy.com plugin that follows one sailor live on the Windy map during an ocean race. The first race is Milan
Koláček (Czech, Class40, boat 216) in the Route du Rhum – Destination Guadeloupe 2026: Saint-Malo → Pointe-à-Pitre,
start Sunday 1 November 2026, 13:02 local (12:02 UTC). Pointing it at someone else in another race means editing one
data file, not the code.

People see the boat on Windy's weather map, its track, speed and distance to the finish, the conditions where it is,
Windy's own point forecast at its position (below the map, on the Wind tab) and which Windy layers to look at.

## How the data gets to everyone

```
YB tracker on the boat ──satellite──▶ YB's servers (app.yb.tl)
                                          │  scheduled every 15 min (often later): .github/workflows/update-track.yml
                                          ▼  runs scripts/fetch-track.mjs, then scripts/check-data.mjs
                         GitHub repository svqs/Race-Tracker-for-Windy.com
                         data/race.json  (by hand: who, which race, start, finish, links, photos)
                         data/track.json (the Action adds positions, never removes any)
                                          │  every 5 min while racetrack is open (raw.githubusercontent.com)
                                          ▼
                         racetrack in each viewer's Windy (src/lib/source.ts)
```

- One public source of truth: everyone sees the same track, nobody can change it from the plugin.
- GitHub caches raw files for up to ~5 min, and GitHub runs scheduled Actions on a best-effort basis: on 30 Oct–1 Nov
  its runs were 3–6 hours apart, not 15 minutes. So a position shows up between ~15 min and several hours after the
  boat sent it (see [data.md](data.md), "How often it runs"). The boat turns grey after 3 hours without a new position.
- The plugin keeps the last good copy in the viewer's browser (`localStorage`, key `racetrack-last`), so it shows
  something at once and keeps working when GitHub or the network fails.
- Secrets (`TRACK_FEED_PASSWORD`, `WINDY_API_KEY`) only exist in GitHub Actions secrets; the plugin has none.

## The repository

```
src/pluginConfig.ts      Windy's plugin settings: name, title "Race Tracker", version, desktop pane 400 px, phone "small"
src/plugin.svelte        the app: phone bar and panel, desktop panel, pages, map, data refresh, Windy's forecast
src/ui/                  Stats (top card numbers), Conditions (three numbers), Icon, WindArrow, application.less (styles)
src/lib/source.ts        where the data lives (DATA_URL), fetching both files, the browser's last copy
src/lib/data.ts          reading race.json / track.json: everything from outside is checked here
src/lib/race.ts          phase (before, racing, finished, retired), quiet, speed, course, distances, the track list
src/lib/forecast.ts      ECMWF wind and waves at the boat (for "Conditions right now")
src/lib/units.ts         units: Windy's own settings (fromWindy) → numbers and labels
src/lib/layers.ts        "Things to look out for": Windy layers and their lines per phase (race.json watch)
src/lib/map/race.ts      the race on the map: track line, boat, start, finish, the line to go
src/lib/athlete.ts       the round photo with initials underneath, the flags
src/lib/theme.ts         colours and sizes (as --rt-* CSS variables)
src/lib/copy.ts          every word the plugin shows
data/                    race.json, track.json, milan.jpg, boat-bg.jpg (and two photos not in use)
scripts/                 fetch-track (the Action's reader), check-data, tests, sample data, packaging, publishing
harness/                 the sandbox: a fake Windy (mock-windy.js), the page, screenshots and scenario tests
.github/workflows/       validate (every push), update-track (scheduled every 15 min), publish-plugin (by hand)
cloudflare/trigger/      a Cloudflare Worker that starts update-track every 5 min (GitHub's schedule is unreliable); not part of the plugin
```

The build is Windy's plugin template: Svelte 4, TypeScript, LESS, Rollup; `@windy/*` imports become `W.*` at build
time. `npm start` serves `https://localhost:9999/plugin.js` with a sample race for Windy's developer mode.

## What the viewer sees

**Desktop** (Windy's right-hand pane, 400 px):

1. **Top bar** (part of the panel: full width, flush to the top and corners, and it stays at the top while the panel
   scrolls): ‹ back to Windy's menu, the Race Tracker logo, a LIVE / SOON /
   FINISHED tag; the athlete's photo, name, flag, boat and race; three numbers that depend on the phase (before:
   starts in, distance, start date · racing: speed, to finish, at sea · after: race time, sailed, average).
2. **One row of three buttons**, which are also the pages:
   - **Find Milan** → the Now page, and the map goes to the boat.
   - **Whole race** (before the start: **The course**) → the Track page, and the map shows the whole race.
   - **Follow Milan** → the Follow page.
3. **Now page:** "Last position … ago" (nothing else, even when the tracker is quiet), "Conditions right now" (wind,
   gusts, waves: three numbers with small labels), Milan's newest YouTube video (only once there is one; Shorts
   upright; up to three earlier ones under it), "Back to Milan" only when Windy's forecast isn't at the boat,
   "Things to look out for" (four Windy layers with one line each; a tap switches Windy's map, the one on the map is
   marked "On the map"), "The boat" (speed, course, average, sailed, to finish, position).
   Windy's own point forecast is open at the boat **below the map**, on its Wind tab, and the map is on Wind
   whenever Race Tracker opens.
4. **Track page:** positions newest first, about one an hour, grouped by day; tapping one shows it on the map.
5. **Follow page:** Follow Milan (Instagram, Facebook), Follow Windy.com (Instagram, Facebook), the race website.

**Phones:** a compact bar under Windy's timeline (logo and the same three buttons). Each button opens its page in a
panel that rises over the map and moves the map so the boat (or the race) sits above the panel; the same button closes
it. If a phone cuts the panel off, it falls back to Windy's classic half-screen pane.

**On the map:** the track (black), a dotted great-circle line to the finish, a green start and a blue finish dot, and the boat: the
athlete's photo in a blue ring with a soft pulse and a Google Maps–style beam showing the course, then flag, name and
speed. Ring and beam turn grey (no pulse) when there's been no position for 3 hours or the race is over. Tapping the
boat opens Windy's point forecast there.

**Look:** Windy's dark greys; the boat photo (`athlete.background`) behind the whole panel, fading to grey at the
bottom; cards as dark glass over it; text directly on the photo is white; highlights in Windy's orange (`#d49500`).
Fonts are Windy's own; the logo is Bariol Regular. Units are the viewer's Windy units (no units setting in racetrack).

## How racetrack uses Windy

| Windy API | Used for | Notes / risk |
|---|---|---|
| `@windy/map` (`map`, `centerMap`) | Leaflet layers for the race; Find; `fitBounds` for Whole race | Standard Leaflet |
| `@windy/broadcast` `rqstOpen('detail', …)` / `rqstClose('detail')` | Opening/closing Windy's point forecast at the boat | Public API |
| `@windy/broadcast` `pluginOpened` / `pluginClosed` / `rqstOpen` (listened to) | Knowing when the forecast opens, closes, or is opened elsewhere | Checked on windy.com |
| `@windy/broadcast` `metricChanged` | Following the viewer's unit changes | Public API |
| `@windy/plugins` `detail.node` | Finding Windy's forecast box to click its own Wind tab | Not an official feature; see below |
| `@windy/store` `overlay` (get, set, on) | Wind on open; "Things to look out for" switches layers and shows which is on | Public API |
| `@windy/trans` `t.WIND` | Windy's own word for its Wind tab (any language) | Public API |
| `@windy/metrics` | The viewer's units (wind, distance, waves, temperature) | Public API |
| `@windy/fetch` `getPointForecastData` | ECMWF wind/gusts and ECMWF/GFS waves for "Conditions right now" | Public API; cached 20 min per ~100 m |
| `@windy/rootScope` `isMobileOrTablet` | Phone or desktop layout | Public API |
| Windy's own CSS for outside plugins | Desktop: `#plugin-windy-plugin-racetrack .plugin__content { padding: 25px 25px 100px }` | An id rule, so racetrack overrides it with `!important` (the top bar needs no top padding); the sandbox adds the same rule |

**Windy's forecast on its Wind tab.** racetrack opens Windy's real forecast at the boat (below the map, where Windy
always shows it). Windy ignores a tab asked for when opening and keeps the last one picked, so racetrack clicks
Windy's own Wind tab in its box (`windTab()` in `src/plugin.svelte`: the `.switch__item` whose text is Windy's word for
Wind) a moment after opening. Only when racetrack opens it (on open, Find Milan, Back to Milan, Show, tapping the boat),
not when it follows the boat, so a tab the viewer picks stays. **If Windy changes that row, the forecast simply keeps
its tab.** (Until 30 Oct racetrack moved Windy's box into the Now page; the owner chose Windy's own place instead.)
Opening Windy's forecast also moves the map a little (Windy does that).

## Safety and privacy (things to review)

- Everything from outside goes through `src/lib/data.ts`: links must be `https://`; photos must be a file name next to
  `race.json`, an `https://` address or a `data:image/…`; text is length-capped; numbers and places are range-checked;
  the track file name can't be a `javascript:` or `data:` address. Values go into the page escaped (`escapeHtml`) or
  through Svelte's text binding.
- Fetches to GitHub send no cookies (`credentials: 'omit'`); the round photos load with `referrerpolicy="no-referrer"`
  (the panel's background photo is a CSS image, so it sends Windy's address as the referrer, like any image).
- Links open in a new tab with `rel="noopener noreferrer"`.
- No secrets in the plugin. The feed password is sent only to the feed (tested: F16).
- A broken data file never replaces a good one: the Action checks before committing, and the plugin keeps the last
  good copy when a fetch fails.

## The owner's decisions (don't undo without asking)

Sophia (the owner) is a designer at Windy. From her reviews, 27–29 Oct 2026:

- Its own look, not spotlog's; Windy's colours and fonts; highlights in Windy orange; name and logo "Race Tracker" (it was "Racetrack") in Bariol Regular.
- No card on the map. Tapping the boat opens Windy's point forecast.
- No look-alike forecast table; Windy's real forecast below the map (30 Oct: no longer in the panel), opened on its Wind tab.
- The map on Wind whenever Race Tracker opens; "Things to look out for" (Wind, Waves, Pressure, Tidal/Ocean currents) instead of the forecast in the panel.
- One row of three buttons (Find Milan, Whole race, Follow Milan) instead of actions + tabs; no Forecast button.
- Videos: a card under the conditions on Find Milan's page, only once there is one (no Video button; 31 Oct).
- Never ahead of the organisers' official tracker: nothing earlier than the start, nothing newer than the official map (31 Oct).
- "Conditions right now": three numbers only (wind, gusts, waves), small labels, nothing else.
- The Follow page: Milan's and Windy's Instagram and Facebook and the race website, nothing else.
- Units come from Windy's settings; no units option.
- Milan's photo without a ring in the panel; on the map a live blue ring and a Google Maps–style beam.
- The boat photo behind the whole panel (F10, the boat far off on the dark sea), cards as dark glass in Windy greys.
- The top bar is part of the panel (full width, square corners) and stays at the top while scrolling.
- Under "Last position", nothing else, even when there are problems.

## Known gaps and open items

- **Not yet seen in real Windy end to end** (developer mode): the forecast opening on its Wind tab, the boat
  following, the layer buttons, phones. The sandbox fakes Windy. See testing.md, section M.
- **YB:** the reader is checked against Milan's real feed (`https://my.yb.tl/oceancall/`, event 17480; positions as
  `{at, t: lat, g: lon}`, no speed or course, so the plugin works them out). Not yet run by the Action on GitHub.
- The Bariol Regular font file isn't embedded yet (`node scripts/embed-logo-font.mjs <file>`); until then the logo
  shows in Bariol only where it's installed.
- "Conditions right now" uses ECMWF; Windy's own forecast below may show another model (the viewer's choice).
- Photos: the owner supplied them; confirm the photographer's permission before publishing.

## How to review

1. Run `npm install && npm run check` (lint, types, unit, data and feed scenarios, build).
2. Run the sandbox and `npm run test:scenarios` (testing.md). Open the sandbox and click through the scenarios.
3. Read `src/lib/data.ts` and `src/lib/source.ts` (everything from outside), then `scripts/fetch-track.mjs` (the
   Action). These decide what everyone sees.
4. Read the "Windy's own point forecast" block in `src/plugin.svelte` (`sendForecast`, `windTab`, `showLayer`, the events).
5. Check the words in `src/lib/copy.ts` against the owner's rules in AGENTS.md (plain, friendly, no symbols that need
   explaining).
6. Do the real-Windy checklist (testing.md, M) if you can.

Report findings with the file and line, what goes wrong, and how to see it (a scenario, a data file, a screenshot).

## Versions and publishing

Bump `version` in both `package.json` and `src/pluginConfig.ts` for every change (`npm run check` checks they
match). Publishing (`publish-plugin` workflow or `scripts/publish.sh`) only when the owner asks.
