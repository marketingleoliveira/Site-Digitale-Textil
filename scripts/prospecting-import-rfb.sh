#!/usr/bin/env bash

set -euo pipefail

ROOT="/var/www/Site-Digitale-Textil"
DATA="/var/lib/digitale-prospecting/rfb"

mkdir -p "$DATA"

PID="$(pm2 pid site-digitale-backend)"

DB_HOST="$(
  tr '\0' '\n' < /proc/$PID/environ \
  | sed -n 's/^DB_HOST=//p'
)"

DB_PORT="$(
  tr '\0' '\n' < /proc/$PID/environ \
  | sed -n 's/^DB_PORT=//p'
)"

DB_NAME="$(
  tr '\0' '\n' < /proc/$PID/environ \
  | sed -n 's/^DB_NAME=//p'
)"

DB_USER="$(
  tr '\0' '\n' < /proc/$PID/environ \
  | sed -n 's/^DB_USER=//p'
)"

DB_PASSWORD="$(
  tr '\0' '\n' < /proc/$PID/environ \
  | sed -n 's/^DB_PASSWORD=//p'
)"

MONTHS=(
  "2026-09"
  "2026-08"
  "2026-07"
)

BASES=(
  "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj"
  "https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj"
)

SOURCE_URL=""
SOURCE_MONTH=""

for MONTH in "${MONTHS[@]}"
do
  for BASE in "${BASES[@]}"
  do
    URL="$BASE/$MONTH/Estabelecimentos0.zip"

    CODE="$(
      curl \
        -4 \
        -I \
        -L \
        --connect-timeout 10 \
        --max-time 30 \
        -sS \
        -o /dev/null \
        -w '%{http_code}' \
        "$URL" \
        || true
    )"

    if [ "$CODE" = "200" ] || [ "$CODE" = "206" ]
    then
      SOURCE_URL="$URL"
      SOURCE_MONTH="$MONTH"
      break 2
    fi
  done
done

if [ -z "$SOURCE_URL" ]
then
  echo "ERRO=RFB_SHARD_NAO_ENCONTRADO"
  exit 1
fi

echo "RFB_MONTH=$SOURCE_MONTH"
echo "RFB_SOURCE=$SOURCE_URL"

ZIP="$DATA/Estabelecimentos0-$SOURCE_MONTH.zip"

if [ ! -s "$ZIP" ]
then
  echo "RFB_DOWNLOAD=INICIANDO"

  curl \
    -4 \
    -L \
    --fail \
    --retry 3 \
    --retry-delay 3 \
    --connect-timeout 20 \
    -o "$ZIP.tmp" \
    "$SOURCE_URL"

  mv "$ZIP.tmp" "$ZIP"
fi

unzip -t "$ZIP" >/dev/null

echo "RFB_ZIP=OK"

MEMBER="$(
  unzip -Z1 "$ZIP" \
  | head -1
)"

echo "RFB_MEMBER=$MEMBER"

SQL="$DATA/import-$SOURCE_MONTH.sql"

set +o pipefail

unzip -p "$ZIP" "$MEMBER" \
| SOURCE_REFERENCE="$SOURCE_URL" \
  PROSPECTING_IMPORT_LIMIT=5000 \
  python3 \
    "$ROOT/scripts/prospecting-parse-rfb.py" \
> "$SQL"

PIPE_STATUS=("${PIPESTATUS[@]}")

set -o pipefail

UNZIP_STATUS="${PIPE_STATUS[0]:-1}"
PYTHON_STATUS="${PIPE_STATUS[1]:-1}"

if [ "$PYTHON_STATUS" -ne 0 ]
then
  echo "ERRO=RFB_PARSER_FALHOU"
  exit "$PYTHON_STATUS"
fi

# 141 = SIGPIPE esperado quando o parser já coletou
# os 5000 candidatos necessários e encerra a leitura.
if [ "$UNZIP_STATUS" -ne 0 ] && [ "$UNZIP_STATUS" -ne 141 ]
then
  echo "ERRO=RFB_UNZIP_FALHOU"
  echo "UNZIP_STATUS=$UNZIP_STATUS"
  exit "$UNZIP_STATUS"
fi

if ! grep -q "COMMIT;" "$SQL"
then
  echo "ERRO=SQL_RFB_INCOMPLETO"
  exit 1
fi

echo "RFB_PARSE=OK"
echo "UNZIP_STATUS=$UNZIP_STATUS"
echo "PYTHON_STATUS=$PYTHON_STATUS"

MYSQL_PWD="$DB_PASSWORD" \
mysql \
  -h "${DB_HOST:-127.0.0.1}" \
  -P "${DB_PORT:-3306}" \
  -u "$DB_USER" \
  "$DB_NAME" \
  < "$SQL"

MYSQL_PWD="$DB_PASSWORD" \
mysql \
  -h "${DB_HOST:-127.0.0.1}" \
  -P "${DB_PORT:-3306}" \
  -u "$DB_USER" \
  "$DB_NAME" \
  -e "
SELECT
  COUNT(*) AS source_pool_total,
  SUM(source_status='new') AS source_pool_new
FROM prospecting_source_pool;
"

echo "RFB_IMPORT=OK"
