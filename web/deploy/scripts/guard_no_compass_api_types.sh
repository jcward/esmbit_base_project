#!/bin/bash

die() {
  echo "$1" >&2
  exit 1
}

set -e

cd "$(dirname "$0")"
cd ../esmbit-dist
(rgrep compass_api_types | grep -i import) && die "Error: Runtime references to compass_api_types are not supported until #25 is resolved"

echo "No compass_api_types detected. Yay!"
