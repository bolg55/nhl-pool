#!/bin/bash
# Record a deployment to an environment in Pact Broker
# Only records on main/master branch (skips feature branches)
#
# Requires: PACTICIPANT, PACT_BROKER_BASE_URL, PACT_BROKER_TOKEN, GITHUB_SHA, GITHUB_BRANCH
# -e: exit on error  -u: error on undefined vars  -o pipefail: fail if any pipe segment fails
set -euo pipefail

. ./scripts/env-setup.sh

PACTICIPANT="${PACTICIPANT:?PACTICIPANT env var is required}"

if [ "$GITHUB_BRANCH" = "main" ] || [ "$GITHUB_BRANCH" = "master" ]; then
  pact-broker record-deployment \
      --pacticipant "$PACTICIPANT" \
      --version "$GITHUB_SHA" \
      --environment "${npm_config_env:-dev}"
else
  echo "Skipping record-deployment: not on main branch (current: $GITHUB_BRANCH)"
fi
