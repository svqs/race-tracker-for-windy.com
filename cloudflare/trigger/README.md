# racetrack-trigger: starts the update-track workflow every 5 minutes

GitHub's own schedule for `update-track` is best effort (on 30 Oct–1 Nov its runs were 3–6 hours apart, not every 15
minutes). This small Cloudflare Worker asks GitHub for a run every 5 minutes instead, through the API
(`workflow_dispatch`). Keep the schedule in `.github/workflows/update-track.yml` as a backup. Both can run: the
workflow's `concurrency` setting queues them, and a run that finds nothing new makes no commit.

Nothing here is part of the plugin, the build or the checks.

## Set it up (once)

1. **A GitHub token that can only start workflows.** On github.com: Settings → Developer settings → Personal access
   tokens → **Fine-grained tokens** → Generate new token.
   - Resource owner: the owner of this repository (`svqs`). GitHub usually only lets the owner create a fine-grained token for
     their own repository, so the owner may have to make it. If you can't pick the repository, a classic token with the
     `repo` scope works, but it can do much more: avoid it if you can.
   - Repository access: **Only select repositories** → this repository.
   - Permissions: **Actions: Read and write**. Nothing else.
   - Expiry: a few weeks after the race ends.
2. **Deploy** (needs a free Cloudflare account; `wrangler` is downloaded on the fly):
   ```
   cd cloudflare/trigger
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN     # paste the token; it is stored in Cloudflare, not in this repository
   npx wrangler deploy
   ```
3. **Check it works:** after 5 minutes the repository's Actions tab shows an `update-track` run, "Manually run by" the
   token's owner. If not, open the Worker in the Cloudflare dashboard → Logs: the error says what GitHub answered
   (`401` token wrong or expired, `403`/`404` no access to the repository or workflow, `422` the workflow has no
   `workflow_dispatch`).

## Change it

- **How often:** `crons` in `wrangler.toml` (UTC), then `npx wrangler deploy`.
- **Another repository, workflow or branch:** `REPO`, `WORKFLOW`, `REF` in `wrangler.toml`.
- **A new token:** `npx wrangler secret put GITHUB_TOKEN` again.

## Turn it off (after the race)

`npx wrangler delete` in this folder (or delete the Worker in the Cloudflare dashboard), and delete the token on
GitHub. Without the Worker, the workflow still runs on GitHub's own schedule.
