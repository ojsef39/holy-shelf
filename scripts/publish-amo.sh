#!/usr/bin/env bash
#
# Submits the built extension to addons.mozilla.org, listed channel, as part of
# a semantic-release run. AMO does the signing; Firefox then serves updates to
# everyone who installed from the AMO URL, which is why nothing here has to
# host an .xpi or generate an updates.json.
#
# Credentials come from the environment so they never touch the repo:
#   WEB_EXT_API_KEY     AMO "JWT issuer"
#   WEB_EXT_API_SECRET  AMO "JWT secret"
# web-ext reads both by itself.
#
set -euo pipefail

version="${1:-unknown}"

if [ -z "${WEB_EXT_API_KEY:-}" ] || [ -z "${WEB_EXT_API_SECRET:-}" ]; then
  echo "[holy-shelf] no AMO credentials in the environment — skipping submission of ${version}."
  echo "[holy-shelf] set WEB_EXT_API_KEY and WEB_EXT_API_SECRET to publish to AMO."
  exit 0
fi

echo "[holy-shelf] submitting ${version} to AMO (listed channel)..."
npm run sign
