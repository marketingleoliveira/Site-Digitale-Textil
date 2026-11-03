#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="/var/www/Site-Digitale-Textil"
UPLOADS="/var/lib/site-digitale-textil/uploads"
DEPLOY="$PROJECT/.safe-deploy"

STAMP="$(date +%Y%m%d-%H%M%S)"

NEW="$DEPLOY/new-$STAMP"
OLD="$DEPLOY/previous-$STAMP"

mkdir -p "$DEPLOY"

cd "$PROJECT"

echo "=============================================="
echo " BUILD SEGURO DIGITALE"
echo "=============================================="

if command -v site-digitale-db-backup >/dev/null 2>&1; then
  site-digitale-db-backup
fi

rm -rf "$NEW"

echo "BUILD_TEMPORARIO=$NEW"

npx vite build \
  --outDir "$NEW" \
  --emptyOutDir

test -s \
  "$NEW/index.html"

rm -rf \
  "$NEW/uploads"

ln -s \
  "$UPLOADS" \
  "$NEW/uploads"

if [ "$(readlink -f "$NEW/uploads")" != "$UPLOADS" ]; then
  echo "ERRO=LINK_UPLOAD_INVALIDO"
  rm -rf "$NEW"
  exit 1
fi


if [ -e "$PROJECT/dist" ] || [ -L "$PROJECT/dist" ]; then
  mv \
    "$PROJECT/dist" \
    "$OLD"
fi

mv \
  "$NEW" \
  "$PROJECT/dist"


rollback() {

  echo "ERRO=VALIDACAO_POS_BUILD"

  rm -rf \
    "$PROJECT/dist"

  if [ -e "$OLD" ] || [ -L "$OLD" ]; then
    mv \
      "$OLD" \
      "$PROJECT/dist"
  fi

  echo "ROLLBACK=EXECUTADO"

  exit 1
}


HOME_CODE="$(
  curl \
    -sS \
    -o /dev/null \
    -w '%{http_code}' \
    http://127.0.0.1:8115/ \
    || true
)"

case "$HOME_CODE" in
  200|301|302)
    ;;
  *)
    rollback
    ;;
esac


TEST_MEDIA="$(
  python3 <<'PY'
from pathlib import Path

root = Path(
    "/var/lib/site-digitale-textil/uploads"
)

preferred = (
    root /
    "original-live"
)

search_root = (
    preferred
    if preferred.exists()
    else root
)

for path in search_root.rglob("*"):

    if (
        path.is_file()
        and
        path.suffix.lower()
        in {
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".gif"
        }
    ):
        print(
            path.relative_to(root)
        )
        break
PY
)"

if [ -n "$TEST_MEDIA" ]; then

  MEDIA_CODE="$(
    curl \
      -sS \
      -o /dev/null \
      -w '%{http_code}' \
      "http://127.0.0.1:8115/uploads/$TEST_MEDIA" \
      || true
  )"

  if [ "$MEDIA_CODE" != "200" ]; then
    rollback
  fi

fi


rm -rf "$OLD"

echo "HOME_HTTP=$HOME_CODE"
echo "MIDIA_TESTE=${TEST_MEDIA:-NENHUMA}"
echo "BUILD=PUBLICADO_COM_SEGURANCA"
