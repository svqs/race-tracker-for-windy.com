#!/usr/bin/env bash
# The update-track Action's loop: every few minutes, Milan's new positions (scripts/fetch-track.mjs) and new videos
# (scripts/fetch-videos.mjs), checked (scripts/check-data.mjs) and committed straight to main. It runs for almost six
# hours (GitHub's limit for one run); then the workflow starts the next run itself. GitHub's own schedule skips and
# delays runs too much for a live race (on 1 Nov: 1–3 hours apart), so the timing lives here instead.
#
#   TRACK_INTERVAL_MINUTES  how often (default 5: the tracker sends a position every 5 minutes)
#   LOOP_MINUTES            how long one run keeps going (default 345, under GitHub's 360)
#   ROUNDS                  stop after this many rounds (tests)
set -u
interval=${TRACK_INTERVAL_SECONDS:-$(( ${TRACK_INTERVAL_MINUTES:-5} * 60 ))}
end=$(( SECONDS + ${LOOP_MINUTES:-345} * 60 ))
git config user.name "racetrack bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
round=0
while :; do
    round=$((round + 1)); started=$SECONDS
    echo "::group::Round $round, $(date -u +%H:%M) UTC"
    # start from the newest main each time (race.json edited by hand, or a push from elsewhere)
    git fetch --quiet origin main && git reset --quiet --hard origin/main || echo "::warning::couldn't get the newest main; using what's here"
    node scripts/fetch-track.mjs data/track.json || echo "::warning::positions: this round failed (the next one tries again)"
    node scripts/fetch-videos.mjs data/videos.json || echo "::warning::videos: this round failed (the next one tries again)"
    if node scripts/check-data.mjs data > /dev/null; then
        if ! git diff --quiet -- data; then
            git add data
            git commit --quiet -m "track: new positions or videos"
            git push --quiet origin HEAD:main && echo "Committed." || echo "::warning::couldn't push (main changed meanwhile); the next round redoes it"
        else
            echo "Nothing new."
        fi
    else
        echo "::warning::a data file didn't pass the check, so nothing was committed"
        git checkout -- data
    fi
    echo "::endgroup::"
    if [ -n "${ROUNDS:-}" ] && [ "$round" -ge "$ROUNDS" ]; then break; fi
    if [ $(( end - SECONDS )) -le "$interval" ]; then break; fi
    wait=$(( interval - (SECONDS - started) ))
    if [ "$wait" -gt 0 ]; then sleep "$wait"; fi
done
echo "Done after $round rounds."
