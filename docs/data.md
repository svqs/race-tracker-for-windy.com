# The race data

racetrack reads two files from this public repository. Everyone who installs the plugin sees the same data, and
nobody can change it from the plugin. Only people with write access to the repository can.

```
data/race.json    who we follow, the race, start and finish   (changed by hand, once per race)
data/track.json   the positions                               (written by the GitHub Action, or by hand)
```

The plugin reads them from
`https://raw.githubusercontent.com/svqs/Race-Tracker-for-Windy.com/main/data/race.json` (`DATA_URL` in
`src/lib/source.ts`), every 5 minutes while it's open. GitHub caches these files for up to 5 minutes, and the Action
runs every 15 minutes (GitHub often starts scheduled runs late), so a position usually shows up 15–30 minutes after
the boat sent it.

## race.json

```json
{
    "athlete": {
        "name": "Milan Koláček", "short": "Milan", "boat": "Class40", "boatName": "", "country": "Czechia",
        "flag": "CZ", "photo": "milan.jpg", "background": "boat-bg.jpg",
        "about": "A few words about him (About tab).",
        "url": "https://his-website.example",
        "links": [{ "label": "Instagram", "url": "https://www.instagram.com/milan_kolacek/" },
                  { "label": "Facebook", "url": "https://www.facebook.com/milankolacekracing" }]
    },
    "race": {
        "name": "Route du Rhum – Destination Guadeloupe 2026", "short": "Route du Rhum 2026",
        "url": "https://www.routedurhum.com",
        "about": "A few words about the race (About tab).",
        "links": [{ "label": "Live tracker", "url": "https://…" }]
    },
    "start": { "name": "Saint-Malo", "lat": 48.68, "lon": -2.02, "time": "2026-11-01T12:02:00Z" },
    "finish": { "name": "Pointe-à-Pitre", "lat": 16.22, "lon": -61.53 },
    "follow": [{ "name": "Windy.com", "links": [{ "label": "Instagram", "url": "https://www.instagram.com/windy_forecast/" },
                                                { "label": "Facebook", "url": "https://www.facebook.com/windyforecast" }] }],
    "watch": [{ "layer": "currentsTide", "phase": "before",
                "text": "Saint-Malo has some of the biggest tides in Europe. At the start they push the whole fleet around." }],
    "status": "racing",
    "endTime": null,
    "source": "Milan’s boat tracker",
    "track": "track.json"
}
```

- Required: `athlete.name`, `start` (name, lat, lon, time) and `finish` (name, lat, lon). Everything else is optional.
- `start.time` is UTC (the `Z`). The Route du Rhum starts at 13:02 in Saint-Malo, which is 12:02 UTC.
- `short` is used on buttons ("Find Milan"). It defaults to the first word of the name.
- `flag` is the two-letter country code (`CZ`). The Czech, French and Slovak flags are drawn; others use the emoji flag.
- `photo` is the athlete's photo on the map and in the panel: a file next to `race.json` (`data/milan.jpg`, square,
  about 200 × 200 px, under 50 KB) or an `https://` address. Until it's there, the initials show. Use a photo the
  athlete or their team has said you may use.
- `background` is a photo of the boat behind the whole panel (`data/boat-bg.jpg`, upright, about 540 × 1200 px,
  under 100 KB). Leave it out for a plain grey panel. Two more are possible: `cover` (a landscape photo filling the top
  card, `data/boat.jpg`) and `boatPhoto` (behind "The boat" on the Now page). The same rules as `photo` for all three.
- The Follow page shows `athlete.links` (their social media), then each entry of `follow` ("Follow Windy.com"), then
  the race website (`race.url`, `race.links`). Nothing else from `about` is shown there at the moment.
- `watch` changes "Things to look out for" on the Now page (Windy layers, one line each, a tap switches the map).
  Without it racetrack shows its own four for the phase: Wind, Waves, Pressure and Tidal currents before the start, then
  Wind, Waves, Pressure and Ocean currents. Each entry replaces the line of its layer, or adds the layer at the top
  (at most four show). `layer` is one of Windy's: `wind`, `gust`, `waves`, `swell1`, `pressure`, `currents`,
  `currentsTide`, `rain`. `phase` (optional): `before` (only before the start) or `racing` (from the start on). `{short}`
  in a line becomes the athlete's short name. Lines up to 160 characters. Write a new one any time during the race,
  e.g. `{ "layer": "pressure", "phase": "racing", "text": "A big low crosses the fleet on Tuesday." }`.
- `videos` fills the Video page: YouTube links, newest first, e.g.
  `"videos": [{ "url": "https://youtube.com/shorts/…", "title": "Reefing for the night", "date": "2026-11-03T18:00:00Z" }]`.
  Any YouTube link works (watch, youtu.be, shorts, live). Shorts play upright; for an upright video posted as a normal
  one, add `"vertical": true`. The newest plays; the others are listed under it. Without any, the page says videos are coming.
- `official` is the organisers' tracker (`url`, and `boat`: its number there, Milan's is 59). The update-track Action
  reads it and never publishes a position the official map doesn't show yet (`scripts/official.mjs`); its log compares
  our track with theirs. If the official map is down for long, set the variable `OFFICIAL_CHECK` = `off`.
- When the race is over, set `"status": "finished"` (or `"retired"`) and `"endTime": "2026-11-14T03:20:00Z"`.
  The plugin then shows the race time instead of the live numbers.
- Links must start with `https://`. `url` is the main website (shown first, as "Website" or "Race website"); `links`
  adds more. Without a `label`, Instagram, Facebook, X, YouTube, LinkedIn, TikTok and Strava are named from the address.
- The start and finish coordinates are approximate (the start line is off Saint-Malo, the finish line is off
  Pointe-à-Pitre). Check them against the race's sailing instructions.

## track.json

```json
{
    "updated": "2026-11-03T08:15:00Z",
    "points": [
        {"t":"2026-11-01T12:30:00Z","lat":48.70,"lon":-2.15,"sog":9.8,"cog":285},
        {"t":"2026-11-01T12:45:00Z","lat":48.72,"lon":-2.31,"sog":10.4,"cog":280}
    ]
}
```

- `t` time (UTC), `lat`, `lon` are required. `sog` (speed in **knots**) and `cog` (course in degrees) are optional.
  Without them, racetrack works them out from the positions before.
- The order doesn't matter. Duplicates, positions in the future and jumps faster than 50 knots are dropped.
- One position per line keeps the file small and every update easy to read in the history.

## Updating the track automatically

`.github/workflows/update-track.yml` runs every 15 minutes. It runs `scripts/fetch-track.mjs`, which reads the
tracker's feed, **adds** the new positions (it never removes any), checks both files with `scripts/check-data.mjs`,
and commits only when something changed. A file that fails the check is never committed.

Set the feed in the repository: **Settings → Secrets and variables → Actions**.

| Name | Kind | Value |
|---|---|---|
| `TRACK_FEED_TYPE` | variable | `yb` (YB / YellowBrick), `inreach` (Garmin MapShare KML feed) or `json` (a list of positions) |
| `TRACK_FEED_URL` | variable | YB: the tracker's public map page (Milan: `https://my.yb.tl/oceancall/`); inReach: `https://share.garmin.com/Feed/Share/<MapShare name>` |
| `TRACK_FEED_EVENT` | variable | YB only, optional: the event number; without it YB's default event is used (Milan: 17480) |
| `TRACK_FEED_SPEED` | variable | YB only: the speed unit in YB's answer, `kn` (default), `kmh` or `ms` |
| `TRACK_FEED_PASSWORD` | secret | only if the feed has a password |

Without `TRACK_FEED_TYPE` the Action does nothing, and the track is updated by hand.

**Milan's boat has a YB (YellowBrick) tracker.** The `yb` reader asks YB's map service for the positions behind the
tracker's public page (the same ones its map shows: time, lat, lng, speed, course). Two things to check on the first
run, against the YB page itself, because YB doesn't document this publicly: that the speeds match (if they're off by
×1.85, set `TRACK_FEED_SPEED` to `kmh`), and that the times match. If Milan's team has a YB Pro account with API
access, that works too: send the details and a reader for it is a small change. Don't take positions from the
official race tracker without the organiser's permission.

## Updating the track by hand

1. Open `data/track.json` on github.com and click the pencil.
2. Add a line before the `]`: `{"t":"2026-11-03T14:00:00Z","lat":45.12,"lon":-9.87},` (mind the commas: every line
   except the last ends with one).
3. Commit. The `validate` workflow checks the file; a red ✗ means the file needs fixing.

## Following someone else

1. Change `data/race.json` (athlete, race, start, finish, status `racing`).
2. Empty `data/track.json` (`"points": []`).
3. Set the new feed in the repository's Actions variables.
4. Change the plugin's `title` and `description` in `src/pluginConfig.ts`, bump the version and publish.
   Only the title in Windy's plugin list needs a new version; the plugin reads everything else from `race.json`.
