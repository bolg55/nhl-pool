#!/bin/bash
# Check if a pacticipant version can be safely deployed
#
# Requires: PACTICIPANT (set by caller), PACT_BROKER_BASE_URL, PACT_BROKER_TOKEN, GITHUB_SHA
# -e: exit on error  -u: error on undefined vars  -o pipefail: fail if any pipe segment fails
set -euo pipefail

. ./scripts/env-setup.sh

PACTICIPANT="${PACTICIPANT:?PACTICIPANT env var is required}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

pact-broker can-i-deploy \
    --pacticipant "$PACTICIPANT" \
    --version="$GITHUB_SHA" \
    --to-environment "$ENVIRONMENT" \
    --retry-while-unknown=10 \
    --retry-interval=30
