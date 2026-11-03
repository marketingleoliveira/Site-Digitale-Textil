#!/usr/bin/env bash

set -u

ROOT="/var/www/Site-Digitale-Textil"
LOG_DIR="/var/log/digitale-prospecting"
STATE_DIR="/var/lib/digitale-prospecting"

mkdir -p "$LOG_DIR"
mkdir -p "$STATE_DIR"

cd "$ROOT" || exit 1

exec 9>/var/lock/digitale-prospecting.lock

if ! flock -n 9
then
  echo "CYCLE=ALREADY_RUNNING"
  exit 0
fi


LOCAL_DATE="$(
  TZ=America/Sao_Paulo \
  date +%F
)"

LOCAL_HOUR="$(
  TZ=America/Sao_Paulo \
  date +%H
)"

LOCAL_HOUR=$((10#$LOCAL_HOUR))


PID="$(pm2 pid site-digitale-backend)"

if [ -z "${PID:-}" ] || [ "$PID" = "0" ]
then
  echo "CYCLE=BACKEND_PID_NOT_FOUND"
  exit 1
fi


DB_HOST="$(
  tr '\0' '\n' < /proc/$PID/environ |
  sed -n 's/^DB_HOST=//p'
)"

DB_PORT="$(
  tr '\0' '\n' < /proc/$PID/environ |
  sed -n 's/^DB_PORT=//p'
)"

DB_NAME="$(
  tr '\0' '\n' < /proc/$PID/environ |
  sed -n 's/^DB_NAME=//p'
)"

DB_USER="$(
  tr '\0' '\n' < /proc/$PID/environ |
  sed -n 's/^DB_USER=//p'
)"

DB_PASSWORD="$(
  tr '\0' '\n' < /proc/$PID/environ |
  sed -n 's/^DB_PASSWORD=//p'
)"


db() {
  MYSQL_PWD="$DB_PASSWORD" \
  mysql \
    -h "${DB_HOST:-127.0.0.1}" \
    -P "${DB_PORT:-3306}" \
    -u "$DB_USER" \
    "$DB_NAME" \
    "$@"
}


# ============================================================
# SINCRONIZAR ESTADO
# ============================================================

db -e "
UPDATE prospecting_source_pool s
JOIN prospecting_candidates c
  ON c.cnpj=s.cnpj
SET
  s.source_status='qualified',
  s.rejection_reason=NULL
WHERE
  c.source_origin='IA_PROSPECCAO'
  AND c.status='qualified';


INSERT INTO prospecting_daily_runs (
  local_date,
  target_qualified
)
SELECT
  '${LOCAL_DATE}',
  target_qualified_per_day
FROM prospecting_daily_policy
WHERE id=1
ON DUPLICATE KEY UPDATE
  target_qualified=
    VALUES(target_qualified);


UPDATE prospecting_daily_runs
SET
  candidates_qualified=(
    SELECT COUNT(*)
    FROM prospecting_candidates
    WHERE
      source_origin='IA_PROSPECCAO'
      AND status='qualified'
      AND qualified_at IS NOT NULL
      AND DATE(
        DATE_SUB(
          qualified_at,
          INTERVAL 3 HOUR
        )
      )='${LOCAL_DATE}'
  )
WHERE local_date='${LOCAL_DATE}';


UPDATE prospecting_daily_runs
SET
  candidates_rejected=
    GREATEST(
      candidates_checked
      - candidates_qualified,
      0
    )
WHERE local_date='${LOCAL_DATE}';
"


read \
  ENABLED \
  START_HOUR \
  END_HOUR \
  TARGET \
  MAX_DAY \
  CRM_ENABLED \
<<< "$(
  db -N -B -e "
    SELECT
      enabled,
      start_hour,
      end_hour,
      target_qualified_per_day,
      max_candidates_per_day,
      crm_delivery_enabled
    FROM prospecting_daily_policy
    WHERE id=1;
  "
)"


read \
  CHECKED \
  QUALIFIED \
<<< "$(
  db -N -B -e "
    SELECT
      candidates_checked,
      candidates_qualified
    FROM prospecting_daily_runs
    WHERE local_date='${LOCAL_DATE}';
  "
)"


echo "DATE=$LOCAL_DATE"
echo "HOUR=$LOCAL_HOUR"
echo "CHECKED=$CHECKED"
echo "QUALIFIED=$QUALIFIED"
echo "TARGET=$TARGET"
echo "CRM=$CRM_ENABLED"


if [ "$ENABLED" != "1" ]
then
  echo "CYCLE=DISABLED"
  exit 0
fi


if [ "${PROSPECTING_HOURLY_MODE:-0}" != "1" ] && { [ "$LOCAL_HOUR" -lt "$START_HOUR" ] || [ "$LOCAL_HOUR" -gt "$END_HOUR" ]; }
then
  echo "CYCLE=OUTSIDE_WINDOW"
  exit 0
fi


if [ "${PROSPECTING_HOURLY_MODE:-0}" != "1" ] && [ "$QUALIFIED" -ge "$TARGET" ]
then
  echo "CYCLE=TARGET_REACHED"
  exit 0
fi


if [ "${PROSPECTING_HOURLY_MODE:-0}" != "1" ] && [ "$CHECKED" -ge "$MAX_DAY" ]
then
  echo "CYCLE=DAILY_LIMIT_REACHED"
  exit 0
fi


# ============================================================
# NÃO CONSULTAR CNPJ QUE JA PASSOU PELO SISTEMA
# ============================================================

SEEN_FILE="$STATE_DIR/seen-cnpj.txt"

db -N -B -e "
SELECT DISTINCT cnpj
FROM prospecting_source_pool
WHERE
  cnpj IS NOT NULL
  AND cnpj <> '';
" > "$SEEN_FILE"


# ============================================================
# DESCOBERTA
# ============================================================

SQL_FILE="$(mktemp "$STATE_DIR/seed-${LOCAL_DATE}-XXXXXXXX.sql")"
echo "DISCOVERY_SQL_FILE=$SQL_FILE"

echo "DISCOVERY=START"

SEEN_CNPJ_FILE="$SEEN_FILE" \
SEED_LIMIT=8 \
MAX_CNPJ_LOOKUPS=10 \
timeout 330 \
python3 \
  scripts/prospecting-seed-web.py \
  > "$SQL_FILE"

SEED_EXIT=$?

echo "DISCOVERY_EXIT=$SEED_EXIT"


if \
  [ "$SEED_EXIT" -eq 0 ] \
  && [ -s "$SQL_FILE" ]
then
  db < "$SQL_FILE"
fi


NEW_COUNT="$(
  db -N -B -e "
    SELECT COUNT(*)
    FROM prospecting_source_pool
    WHERE source_status='new';
  "
)"

echo "NEW_COUNT=$NEW_COUNT"


# ============================================================
# WORKER - MAXIMO 4
# ============================================================

if [ "${NEW_COUNT:-0}" -gt 0 ]
then
  echo "WORKER=START"

  set -a
  source \
    /etc/site-digitale-textil/backend.env
  set +a

  timeout 180 \
  env PROSPECTING_FORCE=1 \
  node \
    backend/src/workers/prospecting-local-worker.js

  echo "WORKER_EXIT=$?"
else
  echo "WORKER=NO_NEW_CANDIDATES"
fi


# ============================================================
# CRESCIMENTO DIRETO
# SOMENTE QUEM JA PASSOU NOS OUTROS GATES
# ============================================================

if [ -f scripts/prospecting-growth-direct.mjs ]; then
  echo "GROWTH=START"

  set -a
  source \
    /etc/site-digitale-textil/backend.env
  set +a

  timeout 90 \
  node \
    scripts/prospecting-growth-direct.mjs

  echo "GROWTH_EXIT=$?"
fi



# ============================================================
# CONTACT ENRICHMENT - IA PROSPECCAO
# ============================================================

echo "CONTACT_ENRICH=START"

set -a
source /etc/site-digitale-textil/backend.env
set +a

CONTACT_ENRICH_LIMIT=4 \
timeout 90 \
node \
  scripts/prospecting-contact-enricher.mjs

echo "CONTACT_ENRICH_EXIT=$?"



# ============================================================
# OFFICIAL COMMERCIAL ACTIVITY
# ============================================================

if [ -f scripts/prospecting-activity-official.mjs ]; then

  echo "COMMERCIAL_ACTIVITY=START"

  set -a
  source /etc/site-digitale-textil/backend.env
  set +a

  ACTIVITY_LIMIT=4 \
  timeout 150 \
  node \
    scripts/prospecting-activity-official.mjs

  echo "COMMERCIAL_ACTIVITY_EXIT=$?"

fi


# ============================================================
# CRM SYNC - IA PROSPECCAO
# ============================================================

if [ "${CRM_ENABLED:-0}" = "1" ] && \
   [ -f scripts/prospecting-sync-worker.mjs ]
then

  echo "CRM_SYNC=START"

  set -a
  source \
    /etc/site-digitale-textil/backend.env
  set +a

  timeout 90 \
  node \
    scripts/prospecting-sync-worker.mjs

  echo "CRM_SYNC_EXIT=$?"

else
  echo "CRM_SYNC=DISABLED"
fi



# ============================================================
# SINCRONIZAR RESULTADO FINAL
# ============================================================

db -e "
UPDATE prospecting_source_pool s
JOIN prospecting_candidates c
  ON c.cnpj=s.cnpj
SET
  s.source_status='qualified',
  s.rejection_reason=NULL
WHERE
  c.source_origin='IA_PROSPECCAO'
  AND c.status='qualified';


UPDATE prospecting_daily_runs
SET
  candidates_qualified=(
    SELECT COUNT(*)
    FROM prospecting_candidates
    WHERE
      source_origin='IA_PROSPECCAO'
      AND status='qualified'
      AND qualified_at IS NOT NULL
      AND DATE(
        DATE_SUB(
          qualified_at,
          INTERVAL 3 HOUR
        )
      )='${LOCAL_DATE}'
  )
WHERE local_date='${LOCAL_DATE}';


UPDATE prospecting_daily_runs
SET
  candidates_rejected=
    GREATEST(
      candidates_checked
      - candidates_qualified,
      0
    )
WHERE local_date='${LOCAL_DATE}';
"


echo "===== DAILY ====="

db -e "
SELECT
  local_date,
  target_qualified,
  candidates_checked,
  candidates_rejected,
  candidates_qualified
FROM prospecting_daily_runs
WHERE local_date='${LOCAL_DATE}';
"


echo "===== QUALIFIED ====="

db -e "
SELECT
  company_name,
  cnpj,
  confidence_score,
  qualified_at
FROM prospecting_candidates
WHERE
  source_origin='IA_PROSPECCAO'
  AND status='qualified'
ORDER BY qualified_at DESC
LIMIT 15;
"


echo "===== CRM ====="

db -e "
SELECT
  crm_delivery_enabled
FROM prospecting_daily_policy
WHERE id=1;
"


echo "CYCLE=FINISHED"
