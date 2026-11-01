# AGENTS.md: start here

This is the entry point for anyone (human or agent) changing **racetrack**, a Windy.com plugin that follows one sailor
live on the map during a race. The first race is Milan Koláček in the Route du Rhum 2026 (start 1 November 2026).

racetrack is spotlog's sibling: the same build and the same phone behaviour, but its own look (Windy's greys and
orange, the boat photo behind the panel; owner's decision). For phone behaviour, do what spotlog does
(`../spotlog-Windy.com-plugin`, its `docs/decisions.md`).

**Reviewing or testing?** [docs/plugin.md](docs/plugin.md) explains the whole plugin; [docs/testing.md](docs/testing.md)
lists every test scenario and the checks to do by hand in real Windy.

## What it does

- **Map:** the track so far (black line; start green, finish blue), the boat (the athlete's round photo in a live blue ring with a soft pulse, and a
  Google Maps–style beam for the course; ring and beam turn grey when the tracker is quiet or the race is over;
  then the flag, the name and the speed), start and finish, and a dotted great-circle line to the finish.
  Tapping the boat opens Windy's own point forecast there. There is no card on the map (owner's decision).
- **Boat photos** (race.json, all optional): `athlete.background` (`data/boat-bg.jpg`, upright) behind the whole panel,
  fading to grey; the cards are dark glass (Windy's darkest greys, see-through and blurred, no colour added; a darker tint was too dark); text right on the photo is white and the grey labels near-white (owner's picks, 29 Oct). Two more ideas are built but switched
  off: `athlete.cover` fills the top card (logo row and numbers on glass), `athlete.boatPhoto` sits behind "The boat".
- **Name and logo:** "Race Tracker" (owner, 29 Oct; it was "Racetrack"), in Bariol Regular, no sparkle. The code keeps the id
  `racetrack` (`windy-plugin-racetrack`, `/racetrack`); the repository is `svqs/Race-Tracker-for-Windy.com`. The font file isn't in the plugin
  yet: `node scripts/embed-logo-font.mjs <bariol regular .woff2>` adds it; until then it shows where Bariol is installed.
- **Panel:** who and which race, three numbers (speed, to finish, time at sea), all in the top bar: full width, flush to the panel's top and corners,
  staying put while the panel scrolls (desktop); then ONE row of three buttons that
  are also the pages (owner's decision, 29 Oct: no separate tabs, no Forecast button):
  **Find Milan** → Now page + the map goes to the boat; **Whole race** → Track page + the map shows the race;
  **Follow Milan** → the Follow page: his social media (`athlete.links`), others to follow (`follow` in
  race.json: Windy.com) and the race website, nothing else (owner's decision, 29 Oct). Now: "Conditions right now" (three numbers: wind, gusts, waves, a small label above
  each, nothing else), the athlete's newest YouTube video right under it, only once there is one (desktop: thumbnail and play
  button first, YouTube's player only on play, its own title bar was too big; phones: a link "Watch video updates from
  the boat" to the newest video in the playlist on YouTube, because YouTube's player refuses some phone setups, error 153; owner, 31 Oct;
  race.json `videos`, or found by the update-track Action (scheduled every 15 min) from race.json `youtube`: data/videos.json), "Things to look out for" (Windy layers, one line each, a tap switches Windy's map; lines from
  `src/lib/layers.ts` + copy.ts, changeable in race.json `watch`), the boat's numbers. Windy's own point forecast is
  open below the map (desktop), on its Wind tab; the map is on Wind whenever racetrack opens (owner, 30 Oct).
  Phones: the same three buttons in the bar; each opens its page in the panel and moves the map above it
  (Find: never closer than zoom 7, or Windy switches to its outdoor map; owner, 31 Oct).
- **Phases:** before the start (countdown, wind at the start, the course; the boat where it is now, no track), racing (live), quiet (no position for
  3 hours: the boat turns grey; the Now page only ever says when the last position came, no other notes), finished or retired (race time, sailed, average).
- **Data:** two JSON files in this repository, read by everyone. See [docs/data.md](docs/data.md).
- **Official tracker check** (race.json `official`, carto.routedurhum.com, `scripts/official.mjs`): holds back positions
  the organisers' map doesn't show yet. SWITCHED OFF on 1 Nov (commented out in `scripts/fetch-track.mjs`); the owner
  turns it back on from 2 Nov afternoon. The track starts at the start either way.

## Ground rules (from Sophia, the owner, a designer at Windy)

- **Phone behaviour is spotlog's**: a compact bar in Windy's pane, pages open in a panel that rises over the map.
  **The look is racetrack's own** and should feel native to Windy. Don't change the UI unless asked.
- **Words** live in `src/lib/copy.ts`; **colours, sizes and map marks** in `src/lib/theme.ts` (`--rt-*` variables).
  Names of people, races and places come from `data/race.json`, never from the code.
- **No symbols that need explaining**; casual, friendly, plain wording; numbers are never cut off on phones.
- **Units:** speeds are m/s inside (the files have knots), distances km inside; shown in the viewer's own Windy units
  (`@windy/metrics`, updated on `metricChanged`; owner's decision, 29 Oct: no units option in racetrack). Boat speeds in
  Beaufort show in knots.
- **Secrets:** `WINDY_API_KEY` and `TRACK_FEED_PASSWORD` live only in GitHub Actions secrets.
- **Publishing** (`publish-plugin` workflow or `scripts/publish.sh`): only when the owner asks for it.
- **Versions:** bump `version` in both `package.json` and `src/pluginConfig.ts` for every change you ship.

## Commands

| What | Command |
|---|---|
| Work on it live in Windy (sample race, rebuild on save, https://localhost:9999/plugin.js) | `npm start`, see [README.md](README.md) |
| Build `dist/plugin.js` + `.min.js` | `npm run build` |
| Everything (lint, types, version pair, unit checks, data and feed scenarios, data files, build) | `npm run check` |
| Data scenarios (loading the files, good and bad) · feed scenarios (the Action's tracker reader) | `npm run test:fetch` · `npm run test:feed` |
| Browser scenarios (the plugin in the sandbox: racing, quiet, offline, broken data, live updates, phones…) | server on :8765, then `npm run test:scenarios` |
| Check the data files | `npm run test:data` |
| Sandbox: fake Windy + the real plugin | `npm run sandbox`, then http://localhost:8765/harness/index.html (`?scenario=` racing, quiet, before, finished, retired, empty, messy, live, slow, broken, offline, cached, nophoto, real) |
| One-file sandbox (`harness/sandbox.html`) | `npm run build && python3 harness/assemble.py` |
| Screenshots of every screen, desktop and phones 320–430 px | server on :8765, then `npm run test:screens` |

## Where things are

```
src/plugin.svelte        the whole app: phone bar + panel, top card, the three buttons and pages, map, Windy's forecast, data refresh
src/ui/                  Stats (photo, name, flag + three numbers), Conditions (three numbers on Now), icons
src/lib/athlete.ts       the round photo (initials underneath) and the flag
src/ui/application.less  the panel's styles (--rt-* variables from theme.ts)
src/lib/source.ts        where the data lives (DATA_URL), fetching, the last copy kept in the browser
src/lib/data.ts          reading race.json and track.json (everything from outside is checked here)
src/lib/race.ts          phase, speed, course, distance to the finish, time at sea; the track list
src/lib/forecast.ts      Windy's forecast where the boat is (ECMWF wind, ECMWF/GFS waves)
src/lib/map/             the race on the map
data/                    race.json and track.json (the live data)
scripts/fetch-track.mjs  the tracker feed → track.json, never ahead of the official map (scripts/official.mjs)
scripts/fetch-videos.mjs YouTube playlist/channel → videos.json (both run by .github/workflows/update-track.yml)
scripts/check-data.mjs   checks the data files (Action, validate workflow, npm run test:data)
cloudflare/trigger/      Cloudflare Worker that starts update-track every 5 min (GitHub's own schedule is unreliable); not part of the plugin, see its README
harness/                 fake Windy (mock-windy.js), sandbox page, screenshots, browser scenarios (test-scenarios.py)
scripts/test-*.mjs       unit checks, data scenarios (test-fetch), feed scenarios (test-feed)
docs/                    plugin.md (the whole plugin, for reviewers), testing.md (every scenario), data.md (the files)
```

## Windy's point forecast and layers

No look-alike forecast tables (owner's decision). racetrack opens Windy's real point forecast (`rqstOpen 'detail'`)
at the boat, where Windy always shows it: below the map (desktop, on its own when racetrack opens and on Find Milan).
It opens it again at each new position (more than 500 m on). Owner's decision, 30 Oct: it used to be moved into the
Now page; it's below the map now (full width, Windy's own place, no unsupported tricks).

- **Wind tab:** whenever racetrack opens it, Windy's forecast shows its Wind tab (owner's rule: the wind arrows).
  Windy ignores `display` when opening and keeps the last tab picked, so racetrack clicks Windy's own Wind tab
  (`.switch__item` whose text is Windy's word `trans.t.WIND`, so any language) once the box is there (`windTab()`).
  Following the boat doesn't touch the tab the viewer picked. If Windy changes that row, the forecast just keeps its tab.
- **Elsewhere:** it stops following when Windy's forecast is opened somewhere else; the Now page then shows
  "Back to Milan" (and Find Milan brings it back too). Phones never open it on their own (Show, or tapping the boat).
- **Layers:** racetrack sets Windy's layer to Wind (`store.set('overlay', 'wind')`) when it opens. "Things to look out
  for" switches it (`showLayer`) and shows which one is on (`store.on('overlay')`); switching pages leaves it alone.
- The code is the "Windy's own point forecast" block in `src/plugin.svelte`, and `src/lib/layers.ts`.

## Unverified in real Windy

- Checked on windy.com (29–30 Oct): `rqstOpen detail` opens it, `pluginOpened 'detail'` fires, `plugins.detail.node`
  is the box, opening it pans the map; `display` is ignored and the last tab stays; clicking its Wind
  `.switch__item` works; `store.set('overlay', …)` works for wind, gust, waves, pressure, currents, currentsTide; Windy
  pads outside plugins' desktop panels 25 px (`#plugin-<name> .plugin__content`, racetrack overrides it).
  Not yet checked inside the plugin in developer mode: the whole flow, and following the boat.
- `fitBounds` with `paddingTopLeft` / `paddingBottomRight` (standard Leaflet; Windy's map is Leaflet).
- The dashed line (`dashArray`) on Windy's map.
