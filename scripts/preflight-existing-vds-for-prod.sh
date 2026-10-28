#!/usr/bin/env bash
# READ-ONLY: inspect capacity and naming conflicts for an isolated production stack.
# Do not print secrets, env file contents, IP networks, mounts, or private records.
set -Eeuo pipefail
if (($#)); then echo "Usage: bash scripts/preflight-existing-vds-for-prod.sh (no arguments)" >&2; exit 2; fi
printf '=== HOST AND CAPACITY (read only) ===\n'
printf 'UTC: '; date -u +%FT%TZ
printf 'Kernel: '; uname -srm
printf 'CPU cores: '; nproc
printf 'RAM GiB available / total: '
awk '/MemAvailable:/ {a=$2} /MemTotal:/ {t=$2} END {printf "%.1f / %.1f\n",a/1048576,t/1048576}' /proc/meminfo
printf 'Disk space (mount, size, available):\n'
df -hP / /opt 2>/dev/null | awk 'NR==1 {print "Filesystem Size Available Mounted_on"; next} {print $1,$2,$4,$6}' | sort -u
printf '\n=== DOCKER ===\n'
if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  echo 'Docker not available to current user'; exit 1
fi
docker version --format 'Server version: {{.Server.Version}}'
docker compose version || true
printf 'Existing project names:\n'
docker ps -a --format '{{.Label "com.docker.compose.project"}}' | sort -u | sed '/^$/d'
printf 'Potential conflicting production containers (names only):\n'
docker ps -a --format '{{.Names}}' | grep -E 'driving-school-supabase-prod' || true
printf 'Existing production-prefixed volumes (names only):\n'
docker volume ls --format '{{.Name}}' | grep -E '^driving-school-supabase-prod' || true
printf 'Existing production-prefixed networks (names only):\n'
docker network ls --format '{{.Name}}' | grep -E '^driving-school-supabase-prod' || true
printf '\n=== LISTEN PORTS (port numbers only) ===\n'
if command -v ss >/dev/null; then
  ss -H -ltn | awk '{split($4,a,":"); print a[length(a)]}' | grep -E '^[0-9]+$' | sort -n -u
else echo 'ss unavailable'; fi
printf '\n=== TARGET DIRECTORY CONFLICT ===\n'
if test -e /opt/driving-school-supabase-prod; then
  echo 'BLOCKED: /opt/driving-school-supabase-prod already exists; inspect manually before proceeding'
else
  echo 'OK: proposed /opt/driving-school-supabase-prod is absent'
fi
printf '\n=== TEST PRESENCE (metadata only) ===\n'
if docker ps --format '{{.Names}}' | grep -qx driving-school-supabase-test-db-1; then
 echo 'TEST database container running; must remain untouched'
else echo 'TEST database container not found/running; investigate'; fi
echo 'Inventory finished. No configuration changes made.'
