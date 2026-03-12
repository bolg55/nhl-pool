#!/bin/bash
# Publish generated pact files to PactFlow/Pact Broker
#
# Requires: PACT_BROKER_BASE_URL, PACT_BROKER_TOKEN, GITHUB_SHA, GITHUB_BRANCH
# -e: exit on error  -u: error on undefined vars  -o pipefail: fail if any pipe segment fails
set -euo pipefail

. ./scripts/env-setup.sh

PACT_DIR="./pacts"

pact-broker publish "$PACT_DIR" \
    --consumer-app-version="$GITHUB_SHA" \
    --branch="$GITHUB_BRANCH" \
    --broker-base-url="$PACT_BROKER_BASE_URL" \
    --broker-token="$PACT_BROKER_TOKEN"
