#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="/var/www/Site-Digitale-Textil"
UPLOADS="/var/lib/site-digitale-textil/uploads"
DIST="$PROJECT/dist"

if [ ! -d "$UPLOADS" ]; then
  echo "ERRO=STORAGE_REAL_NAO_EXISTE"
  exit 1
fi

mkdir -p "$DIST"

CURRENT="$(
  readlink -f "$DIST/uploads" \
  2>/dev/null \
  || true
)"

if [ "$CURRENT" != "$UPLOADS" ]; then

  rm -rf \
    "$DIST/uploads"

  ln -s \
    "$UPLOADS" \
    "$DIST/uploads"

  echo "UPLOAD_LINK=REPARADO"

else

  echo "UPLOAD_LINK=OK"

fi
