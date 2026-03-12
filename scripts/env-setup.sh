#!/bin/bash
# -e: exit on error  -u: error on undefined vars (catches typos/missing env vars in CI)
set -eu

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

export GITHUB_SHA="${GITHUB_SHA:-$(git rev-parse --short HEAD)}"
export GITHUB_BRANCH="${GITHUB_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
