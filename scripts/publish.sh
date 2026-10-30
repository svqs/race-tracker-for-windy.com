#!/usr/bin/env bash
# Publishes racetrack to windy-plugins.com (same steps as .github/workflows/publish-plugin.yml).
# Needs a "Windy Plugins API" key from https://api.windy.com/keys
#   WINDY_API_KEY=xxxx ./scripts/publish.sh
# The response contains the install URL: https://windy-plugins.com/<user id>/windy-plugin-racetrack/<version>/plugin.min.js
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${WINDY_API_KEY:-}" ]; then
  echo "Set WINDY_API_KEY first (https://api.windy.com/keys)" >&2
  exit 1
fi
npm run build
node scripts/package-plugin.mjs
echo "Publishing $(node -p "JSON.parse(require('fs').readFileSync('dist/plugin.json')).version")…"
curl -s --fail-with-body -XPOST 'https://node.windy.com/plugins/v1.0/upload' \
  -H "x-windy-api-key: ${WINDY_API_KEY}" \
  -F "plugin_archive=@plugin.tar"
echo
rm -f plugin.tar
