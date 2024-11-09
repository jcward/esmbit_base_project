#!/usr/bin/bash

if [ ! -f esmbit-dist/esmbit-import-map.json ]; then
    echo "Run bit.js build first, to populate ./esmbit-dist"
    exit 1
fi

npx jscpd ./esmbit-dist/
