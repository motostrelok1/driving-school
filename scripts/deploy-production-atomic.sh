#!/usr/bin/env bash
# Production deploy: build away from root-owned dist, then atomically switch a symlink.
# Requires restricted passwordless sudo for staging install/symlink. Fail closed if unavailable.
set -euo pipefail
umask 022
ROOT=/var/www/driving-school
cd "$ROOT"
git fetch origin main
git merge --ff-only origin/main
npm ci
# No modifications to the live dist before build succeeds.
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
npm run build -- --outDir "$stage/dist"
test -s "$stage/dist/index.html"
test -s "$stage/dist/sw.js"
# Validate deployment permissions BEFORE writing into live release area.
test -L "$ROOT/dist" || { echo "ERROR: dist is not a symlink; operator must establish release layout before enabling atomic deploy" >&2; exit 1; }
release="$ROOT/releases/$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
sudo -n mkdir -p "$ROOT/releases"
sudo -n mkdir "$release"
sudo -n cp -a "$stage/dist/." "$release/"
sudo -n chmod -R a+rX "$release"
sudo -n test -r "$release/index.html"
lnlink="$ROOT/.dist-next-$$"
sudo -n ln -s "$release" "$lnlink"
sudo -n mv -Tf "$lnlink" "$ROOT/dist"
curl --fail --silent --show-error --max-time 15 https://dvizh-school.ru/ >/dev/null
echo "DEPLOY PASS: $(git rev-parse --short HEAD)"
