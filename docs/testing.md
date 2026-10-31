# Testing racetrack

Four kinds of tests, from fastest to slowest. The first three run on any computer without Windy. The last needs
real Windy in developer mode, because some things only Windy itself can answer.

| | What | Command | Time |
|---|---|---|---|
| **D** | Data: reading and loading `race.json` / `track.json`, the browser's last copy, the race over time | `npm run test:fetch` | ~2 s |
| **F** | Feed: the GitHub Action's tracker reader (`scripts/fetch-track.mjs`) against a fake YB / inReach / JSON tracker | `npm run test:feed` | ~10 s |
| **S** | Browser: the real plugin in the sandbox (a fake Windy), one scenario at a time | `npm run test:scenarios` | ~90 s |
| **M** | By hand in real Windy (developer mode), and the first run against Milan's real tracker | the checklists below | ~20 min |

`npm run check` runs D and F with lint, types, the unit checks (`npm run test:core`), the data files
(`npm run test:data`) and the build. Run it before every push. For S, start the sandbox server first:

```
npm run build && python3 -m http.server 8765 &     # from the repository folder
npm run test:scenarios                              # screenshots in /tmp/racetrack-scenarios
npm run test:screens                                # every page, desktop and phones 320–430 px, in /tmp/racetrack-screens
```

Every scenario prints ✓ or ✗ and the script exits with 1 when any check fails, so they can run in CI.

## D · Data (scripts/test-fetch.mjs)

The plugin fetches two files from GitHub every 5 minutes. These scenarios feed it good and bad answers through a fake
`fetch`, and check what it keeps.

| # | Scenario | Expected |
|---|---|---|
| D1 | Both files fine | The race and its positions; `track.json` read next to `race.json`; a cache-busting `?v=` (GitHub keeps files ~5 min); no cookies sent; a copy kept in the browser |
| D2 | GitHub down (503) | An error, so the plugin keeps showing the last good copy |
| D3 | Offline | An error; the copy from an earlier visit is still there |
| D4 | `race.json` is an HTML error page | An error, nothing replaced |
| D5 | `race.json` without a start or finish | An error that says what's missing |
| D6 | Before the start, no `track.json` yet (404) | Fine: no positions |
| D7 | After the start, `track.json` missing (404) | An error, the last copy stays |
| D8 | `track.json` cut off half way | An error, the last copy stays |
| D9 | A broken copy in browser storage | Ignored |
| D10 | Positions out of order, twice, from the future, a 400-knot glitch, rows without a time or place | Only good positions, in time order |
| D11 | Times as seconds, milliseconds or text; `lng` instead of `lon`; `[t, lat, lon]` rows | All read |
| D12 | No speed or course in the file | Worked out from the positions |
| D13 | Speeds that make no sense (negative, 90 kn) | Left out |
| D14 | 25,000 positions | Read in well under a second; the newest 20,000 kept |
| D15 | Links | Only `https://`; the main website first; Instagram/Facebook… named from the address; `http:` and `javascript:` dropped |
| D16 | Photos | A file name or `https://` only |
| D17 | `follow` (Windy.com…) | Kept with its links; entries without a name or links dropped |
| D18 | `status` | `finished` / `retired`; anything else is racing |
| D19 | `track` pointing to a script | Back to `track.json` |
| D20 | Racing | The last position and its age; not quiet |
| D21 | Quiet | After 3 hours without a position (exactly 3 h is still fine) |
| D22 | Started, no position yet | Racing, no boat |
| D23 | Before the start | Countdown phase, the whole course to go |
| D24 | Finished / retired | No live speed; the race time |
| D26 | Before the start, a position in the harbour | The boat shows there; no track, nothing sailed; grey after 3 h without a position |
| D27 | `videos` | Every kind of YouTube link read, others dropped; Shorts upright; newest first |
| D28 | `videos.json` (found by the Action) with race.json's videos | One list, newest first; race.json wins for the same video; a missing or broken file changes nothing |
| D25 | `watch` (things to look out for) | Only Windy layers racetrack knows, with a line; a line replaces racetrack's for that layer, a new layer goes first, at most four; `phase` before/racing; the defaults otherwise |

## F · Feed (scripts/test-feed.mjs)

The GitHub Action runs `scripts/fetch-track.mjs` every 15 minutes, then `scripts/check-data.mjs`, and commits only when
something changed and the check passed. Each scenario runs the real script in a fresh folder against a fake tracker.

| # | Scenario | Expected |
|---|---|---|
| F1 | No feed set | Nothing happens (updates by hand) |
| F2 | YB, three positions | Added in time order, one per line; asks YB for the right tracker; the data check passes |
| F3 | YB answers the same again | "No new positions", file untouched (no commit) |
| F4 | Old and new together; then an empty answer | Only the new added; nothing ever removed |
| F5 | YB speeds in km/h (`TRACK_FEED_SPEED=kmh`) | Stored in knots |
| F6 | YB text times (`datetime`) instead of `at` | Read |
| F7 | The same position twice in one answer | Stored once |
| F8 | YB down (500) | The run fails, file untouched |
| F9 | YB answers HTML | The run fails, file untouched |
| F10 | Rows without a place (`lat: null`, `lng: "x"`) | Skipped (not stored at 0°, 0°) |
| F11 | A position from the future (tracker clock glitch) | Skipped, and later real positions still come in |
| F12 | YB link without a tracker name | A clear error |
| F13 | Garmin inReach KML | Read; km/h stored as knots; asks only since the last position |
| F14 | A plain JSON list | Read |
| F15 | Unknown feed type | A clear error, nothing written |
| F16 | Feed password | Sent to the feed only; never written to `track.json` |
| F17 | YB without `TRACK_FEED_EVENT` (my.yb.tl/oceancall) | Asks YB's GetEvents and uses the default event (17480, "All time"); `TRACK_FEED_EVENT` wins when set |
| F18 | YB answers `{"error": …}` | The run fails with YB's message, file untouched; no event at all → a clear error |
| F19 | YB times in milliseconds; an empty answer before the tracker reports | Read; nothing written |
| F20 | The first run, days before the start | The last day's positions come in (the boat in the harbour) |
| F22 | Official map: our positions newer than its newest | Wait; come in once the official map has them |
| F23 | Official map before the start (its real answer of 31 Oct: times still in the future) | Positions up to now come in |
| F24 | Official map can't be read | The run fails, nothing new published; `OFFICIAL_CHECK=off` skips it |
| F25 | Our track vs the official one | Compared in the log; a warning when more than 2 NM apart |
| F26 | The real reader (headless Chrome, a stand-in of Geovoile's map) | Finds the boat by number or by the sailor's name (with or without accents) |
| F27 | No YouTube playlist or channel | Nothing happens |
| F28 | A playlist | New videos newest first, Shorts upright, titles unescaped, nothing from long before the start; the same again: file untouched |
| F29 | A channel by its @handle | The channel id from its page; a Short linked as a normal video found via youtube.com/shorts/ |
| F31 | The real playlist (its feed of 31 Oct) | Its video, wide |
| F30 | YouTube down / playlist gone | The video step fails, videos.json untouched; positions still go out |
| F21 | YB's real answer (my.yb.tl/oceancall, 30 Oct: `t` latitude, `g` longitude, no speed) | Read exactly |

## S · Browser (harness/test-scenarios.py)

The sandbox (`harness/index.html`) is a fake Windy map with the real, built plugin. `?scenario=` picks the race; the
pills at the top switch between them. `&units=metric` pretends the viewer uses km/h and km in Windy, `&bg=0…11`
changes the photo behind the panel, `&embed` hides the pills.

| # | Scenario (`?scenario=`) | Checks |
|---|---|---|
| S1 | `racing` (day 4) | Three buttons, Find Milan selected; "Last position 12 min ago"; the boat on the map in live blue; three conditions; Windy's forecast below the map on its Wind tab; the map on Wind; Wind, Waves, Pressure, Ocean currents to look out for, Wind marked; no extra notes |
| S2 | `quiet` (no position for 5 h) | "Last position 5 h ago" and nothing else; the boat grey, no pulse |
| S3 | `before` (the boat in the harbour) | "The race hasn’t started yet"; the boat where it is, no speed, no track; countdown; "Conditions at the start"; no boat; the middle button says "The course" |
| S4 | `finished` | "Finished in…"; race time instead of live speed; the boat grey |
| S5 | `retired` | "Out of the race"; race time; the boat grey |
| S6 | `empty` (started, no position yet) | The panel shows, no boat; "The race has started. Milan’s first position shows up here soon."; Track says there are no positions yet |
| S7 | `messy` (duplicates, out of order, a glitch, a future point, bad rows) | A sane speed; the right "Last position"; the track list newest first, no repeats |
| S8 | `live` (each fetch brings a new position) | After a refresh: "just now", the boat moved, Windy's forecast follows and stays below the map |
| S9 | `slow` (each file takes 4 s) | "Loading the race…", then the race |
| S10 | `broken` (`track.json` isn't JSON, nothing earlier) | "Couldn't load the race" with Try again |
| S11 | `offline`, then back online | The error card; Try again loads the race once online |
| S12 | `cached` (an earlier visit, now nothing loads) | The earlier race shows straight away, no error on top |
| S13 | `nophoto` | Initials (MK) in the panel and on the map; the broken photo draws nothing |
| S14 | `racing&units=metric` | km/h and km from the viewer's Windy settings |
| S15 | Windy's forecast and layers | No forecast card while it's at the boat; Whole race → it stays open; opened elsewhere + Find Milan → back at the boat on Wind; opened elsewhere → "Back to Milan" → back on Wind; Pressure → Windy's map on pressure, marked; pages keep the layer; a layer picked in Windy is marked; opening again → Wind; before the start Tidal currents; the real race.json's Saint-Malo line |
| S16 | Scrolling | The top card stays at the top; nothing (Windy's forecast included) draws over it |
| S17 | The Follow page | Milan ×2, Windy.com ×2, the race website; every link https, new tab, noopener; no second header |
| S19 | The video card (`&video=wide`, `short`, `both`, `auto`) | No video: no card; right under the conditions; first the thumbnail and a play button (no YouTube player, so no YouTube title bar), play starts it; the title under it regular, not bold; wide 16:9 and Shorts upright, privacy-enhanced YouTube; the earlier one listed and playable; the player goes when leaving the page; found by the Action (videos.json) shows too; on a phone a link "Watch video updates from the boat" to the newest video on YouTube (in the playlist; a Short as a Short), no player |
| S18 | Phones 320 and 390 px | Three buttons in the bar, names whole; Find Milan stays out (a box over 2° across, at most zoom 7: no outdoor map); Find Milan opens the Now page with the boat above the panel; nothing sticks out sideways; the same button closes the panel |

Every scenario also checks that the page threw no script errors.

What the sandbox can't prove: it fakes Windy. Windy's real point forecast is a white stand-in box with the same
parts (thin line, day row, wide bottom bar, high z-indexes), the map is a simple projection, and fonts differ.

## M · By hand in real Windy

Start `npm start` (it serves the plugin and a sample race from this computer), open https://www.windy.com/developer-mode,
load `https://localhost:9999/plugin.js`. See the [README](../README.md). Desktop first, then a phone (or Chrome's
phone view).

**Desktop**
- [ ] The panel opens; Race Tracker logo in the full-width top bar, photo behind the panel, Milan's photo, name, flag and three numbers.
- [ ] The top bar reaches the panel's top and both sides (no photo showing around it); scroll: it stays at the top.
- [ ] Windy's point forecast opens below the map at Milan's position, on its **Wind** tab (also when Windy is in
      another language). The map is on the Wind layer.
- [ ] Pick another tab in Windy's forecast, wait for a new position: the tab stays. Find Milan: back on Wind.
- [ ] Things to look out for: tap Waves, Pressure, Ocean / Tidal currents: Windy's map switches and the row says "On the
      map". Pick a layer in Windy's own menu: the row follows. Close and reopen Race Tracker: Wind again.
- [ ] Whole race: the map shows the whole race and the Track page opens; the forecast stays open.
- [ ] Find Milan: the map goes to him.
- [ ] Click somewhere else on the map and open Windy's forecast there: the Now page says "Back to Milan"; the button works.
- [ ] Change units in Windy's settings (wind km/h, distance km): racetrack follows without a reload.
- [ ] Tap Milan's photo on the map: Windy's forecast at his position.
- [ ] Close racetrack: Windy's forecast is back under the map (or closed), nothing left behind.
- [ ] Note whether opening the forecast moves the map (Windy does this on its own) and whether that's acceptable.

**Phone**
- [ ] The bar under the timeline: Race Tracker and three buttons.
- [ ] Video: on a phone, "Watch video updates from the boat" under the conditions opens the newest video in YouTube.
- [ ] Find Milan opens the Now page in a panel over the map, the boat visible above it; the same button closes it.
- [ ] Whole race shows the race above the panel; Follow Milan shows the links.
- [ ] "Show" on the Now page opens Windy's forecast over the map.
- [ ] Nothing cut off at 320 px wide.

**Live data (once the repository is on GitHub)**
- [ ] With `npm run build` (not `npm start`) loaded in developer mode, the plugin reads `data/race.json` from GitHub.
- [ ] Edit `data/track.json` on github.com (add a position): within ~5–10 minutes the boat moves in an open plugin.
- [ ] Break `data/track.json` on purpose in a branch: the `validate` workflow fails (red ✗).

**First run against Milan's YB tracker**
- [ ] Set `TRACK_FEED_TYPE=yb` and `TRACK_FEED_URL=https://my.yb.tl/oceancall/` (the event is found by itself).
- [ ] Run the `update-track` workflow by hand. The log says how many positions were added.
- [ ] Compare the newest position in `track.json` with YB's own map: the same place, the same time (UTC), the same
      speed. If speeds are ×1.85 off, set `TRACK_FEED_SPEED=kmh`; if the times are off by hours, tell a developer.
- [ ] Leave it running a few hours: one commit per new batch of positions, none when nothing changed.

## Adding a scenario

- Data: add a `scenario('D25 …', async () => { … })` to `scripts/test-fetch.mjs`.
- Feed: add `F17` to `scripts/test-feed.mjs`; set `answer` to what the fake tracker should send.
- Browser: teach `harness/mock-windy.js` the new `?scenario=` (look for "made-up race"), add it to the pills in
  `harness/index.html`, then add its checks to `harness/test-scenarios.py`.
- Add a row to the table above.
