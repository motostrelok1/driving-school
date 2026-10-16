# Auth schema drift: audit_log_entries.ip_address

First full-restore lab run confirmed the default `supabase/postgres:17.6.1.136` bootstrap works in a disconnected container and `public` pre-data restore succeeds. Auth data-only import failed in one transaction because the cloud dump includes `auth.audit_log_entries.ip_address`, not present in local schema.

`scripts/supabase-auth-lab-retry.sh` continues **only in the existing isolated lab container**, with fixed container/volume names, disconnected networking and read-only dump mount; refuses to run if Auth users are already present. It deliberately omits historical **Auth audit log data only** and retries all other Auth tables with `--single-transaction --exit-on-error`. Any further incompatibility halts the import. No data is deleted and production is untouched.

**Caution:** This exclusion is diagnostic, NOT an approved production migration. Before cutover preserve audit history through a reviewed schema mapping (or accept a documented, authorized omission), and check every Auth table, FK, identities, privileges and login. A successful Auth import does not mean full Supabase restore. The old lab one-shot script cannot be rerun because its test container and volume are intentionally retained.

Use only after review and do not install as a GitHub Actions privileged command.
