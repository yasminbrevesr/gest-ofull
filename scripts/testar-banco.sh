#!/usr/bin/env bash
# Valida as migrations e as regras de acesso (RLS) num Postgres local
# temporário, sem precisar do Supabase nem de Docker.
# Requisito: binários do PostgreSQL 15+ (initdb, pg_ctl, psql) no PATH ou em
# /usr/lib/postgresql/<versão>/bin.
#
# Uso: ./scripts/testar-banco.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | sort -V | tail -1)")"
WORK="$(mktemp -d)"
PORT="${PGPORT_TESTE:-54329}"

cleanup() {
  "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Rode como usuário comum (o Postgres não inicia como root)." >&2
  exit 1
fi

"$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=("$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

echo "→ Ambiente simulado do Supabase"
"${PSQL[@]}" -f "$ROOT/supabase/tests/00_stub_supabase.sql" >/dev/null

for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ Migration $(basename "$file")"
  "${PSQL[@]}" -f "$file" >/dev/null
done

for file in "$ROOT"/supabase/tests/*.sql; do
  [ "$(basename "$file")" = "00_stub_supabase.sql" ] && continue
  echo "→ Teste $(basename "$file")"
  "${PSQL[@]}" -f "$file" 2>&1 | sed -n -e 's/.*NOTICE:  /   /p' -e '/ERROR/p'
done

echo "✓ Banco validado"
