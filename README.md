# Race Tracker

A Windy.com plugin to follow one sailor live during an ocean race: the boat and its track on the Windy map, speed,
distance to the finish, the conditions where the boat is, and which Windy layers to watch. Built for **Milan Koláček**
in the **Route du Rhum 2026** (Saint-Malo → Guadeloupe, start 1 November 2026).

Everyone sees the same data: `data/race.json` (who and which race, edited by hand) and `data/track.json` (the
positions, added every 15 minutes by the `update-track` workflow from the boat's tracker). See [docs/data.md](docs/data.md).

## Develop

```
npm install
npm start        # serves https://localhost:9999/plugin.js with a made-up race, rebuilds on save
```

Open https://localhost:9999/plugin.js once and accept the certificate warning, then load that address in
https://www.windy.com/developer-mode. Reload Windy after each change.

Without Windy: `npm run sandbox`, then http://localhost:8765/harness/index.html (a fake Windy map with the real plugin;
pick a scenario at the top).

Before pushing: `npm run check`. Bump `version` in both `package.json` and `src/pluginConfig.ts` for every release.

## GitHub settings

The repository must be **public**: the plugin reads `data/` from `raw.githubusercontent.com`.

| Setting (Settings → Secrets and variables → Actions) | For |
|---|---|
| Secret `WINDY_API_KEY` ("Windy Plugins API" key from https://api.windy.com/keys) | publishing |
| Variables `TRACK_FEED_TYPE` (`yb`), `TRACK_FEED_URL`, `TRACK_FEED_EVENT`; secret `TRACK_FEED_PASSWORD` if needed | the live track (until set, `update-track` does nothing) |

## Publish

Actions → **publish-plugin** → Run workflow. The run's summary shows the install URL.

## More

- [AGENTS.md](AGENTS.md): ground rules and where things are (for developers and agents)
- [docs/plugin.md](docs/plugin.md): how the whole plugin works (for reviewers)
- [docs/testing.md](docs/testing.md): test scenarios and the checklist for real Windy
