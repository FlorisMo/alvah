#!/usr/bin/env bash
# Waits for the background meshy-gen run to finish, then optimizes + stages every
# refined asset and refreshes audio. Idempotent: safe to run any time. Launch
# detached:  nohup bash scripts/finalize-assets.sh > assets-gen/finalize.log 2>&1 &
set -u
cd "$(dirname "$0")/.."

echo "[finalize] waiting for meshy-gen to finish…"
while pgrep -f meshy-gen.mjs >/dev/null 2>&1; do sleep 60; done
echo "[finalize] generation done — optimizing + staging."

node scripts/gltf-optimize.mjs
node scripts/audio-fetch.mjs

echo "[finalize] complete. Models → public/models/, audio → public/audio/."
