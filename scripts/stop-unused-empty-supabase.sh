#!/usr/bin/env bash
# Stop ONLY the known empty, standalone self-hosted Supabase project.
# Keeps containers, volumes, bind-mounted DB data, compose files and secrets intact.
set -Eeuo pipefail
expected=(supabase-storage realtime-dev.supabase-realtime supabase-auth supabase-rest supabase-db supabase-edge-functions supabase-envoy)
mapfile -t all < <(docker ps -a --filter label=com.docker.compose.project=supabase --format '{{.Names}}' | sort)
mapfile -t wanted < <(printf '%s\n' "${expected[@]}" | sort)
if [[ "${all[*]}" != "${wanted[*]}" ]]; then
  printf 'STOP: unexpected containers in project supabase. No changes.\nFound:\n%s\n' "${all[*]}" >&2
  exit 1
fi
if docker ps -a --filter label=com.docker.compose.project=driving-school-supabase-test --format '{{.Names}}' | grep -q '^$'; then :; fi
echo 'Stopping exactly seven containers of project supabase; no volumes or files deleted.'
docker stop "${expected[@]}"
echo 'Remaining running project containers:'
docker ps --filter label=com.docker.compose.project=supabase --format '{{.Names}} {{.Status}}'
echo 'TEST containers remain:'
docker ps --filter label=com.docker.compose.project=driving-school-supabase-test --format '{{.Names}} {{.Status}}'
