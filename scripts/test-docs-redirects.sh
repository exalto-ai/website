#!/bin/sh
set -eu

landing_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test -s "$landing_root/dist/index.html"
test ! -d "$landing_root/dist/docs"
if (
  cd "$landing_root"
  VITE_PRODUCT_ORIGIN=https://seal.example.test/ \
    node --input-type=module -e "await import('./vite.config.js')" >/dev/null 2>&1
); then
  echo 'VITE_PRODUCT_ORIGIN unexpectedly accepted a trailing slash' >&2
  exit 1
fi

container_id=
trap 'if test -n "$container_id"; then docker stop "$container_id" >/dev/null; fi' EXIT

# Use the real production routing with the default and an alternate product
# origin. Do not follow redirects or contact the hosted API in this test.
for product_origin in https://seal.exalto.ai https://seal.example.test; do
  container_id=$(docker run --rm --detach --publish 127.0.0.1::80 \
    --env "EXALTO_PRODUCT_ORIGIN=$product_origin" \
    --mount "type=bind,src=$landing_root/Caddyfile.fly,dst=/etc/caddy/Caddyfile,readonly" \
    --mount "type=bind,src=$landing_root/dist,dst=/usr/share/caddy,readonly" \
    caddy:2.10-alpine)
  address=$(docker port "$container_id" 80/tcp)
  origin="http://$address"
  curl --fail --silent --show-error --retry 10 --retry-all-errors \
    --retry-delay 1 --max-time 5 "$origin/" >/dev/null

  for path in /docs /docs/ /docs/getting-started/ /docs/how-it-works/ \
    /docs/hosted-credits/ /docs/trace-packages/ /docs/share/ \
    '/docs/getting-started/?section=connect-an-sdk&from=landing'; do
    actual=$(curl --silent --show-error --max-time 5 --output /dev/null \
      --write-out '%{http_code} %{redirect_url}' "$origin$path")
    expected="308 $product_origin$path"
    test "$actual" = "$expected" || {
      echo "expected '$expected', got '$actual'" >&2
      exit 1
    }
  done

  for path in / /favicon.svg /docs-other; do
    actual=$(curl --silent --show-error --max-time 5 --output /dev/null \
      --write-out '%{http_code} %{redirect_url}' "$origin$path")
    test "$actual" = '200 ' || { echo "$path: unexpected $actual" >&2; exit 1; }
  done
  docker stop "$container_id" >/dev/null
  container_id=
done
echo 'Landing docs redirect to the product origin; other routes still serve.'
