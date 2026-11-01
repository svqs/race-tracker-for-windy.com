// A Cloudflare Worker that starts the update-track workflow on a timer (see wrangler.toml for how often).
//
// Why: GitHub's own schedule (cron in .github/workflows/update-track.yml) is best effort and was seen running only
// every 3-6 hours. A manual run ("workflow_dispatch") started through GitHub's API is not part of that schedule, so
// this Worker asks for one every few minutes. The workflow's "concurrency" setting queues runs, so a slow run never
// piles up extra ones.
//
// It needs the secret GITHUB_TOKEN (a fine-grained token for this one repository with "Actions: Read and write" and
// nothing else): `npx wrangler secret put GITHUB_TOKEN`. There is deliberately no fetch handler: the Worker has no web
// address, so nobody can start runs by opening a link.
export default {
    async scheduled(_event, env, ctx) {
        ctx.waitUntil(trigger(env));
    },
};

async function trigger(env) {
    const url = `https://api.github.com/repos/${env.REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
    const r = await fetch(url, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${env.GITHUB_TOKEN}`,
            accept: 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
            'user-agent': 'racetrack-trigger', // GitHub's API refuses requests without one
            'content-type': 'application/json',
        },
        body: JSON.stringify({ ref: env.REF || 'main' }),
    });
    // 204 = started. Anything else is shown in the Worker's logs in the Cloudflare dashboard (401: the token is wrong
    // or has expired; 403/404: it can't reach the repository or the workflow; 422: the workflow has no workflow_dispatch).
    if (r.status !== 204) {
        throw new Error(`GitHub answered ${r.status} for ${env.REPO} ${env.WORKFLOW}: ${(await r.text()).slice(0, 300)}`);
    }
}
