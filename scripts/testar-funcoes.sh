#!/usr/bin/env bash
# Verifica os tipos e roda os testes das Edge Functions (precisa do Deno 2:
# https://deno.com — ou `npx deno`).
set -euo pipefail
cd "$(dirname "$0")/../supabase/functions"
DENO="${DENO:-deno}"
command -v "$DENO" >/dev/null 2>&1 || DENO="npx --yes deno"
$DENO check ./*/index.ts
$DENO test --allow-env _shared/
