#!/bin/sh
# So it's hard / non-standard to get Svelte to be a shared runtime, which means
# that the state / functions used in all the ES Modules are a shared copy (instead
# of the default, where each module would have Svelte compiled it.)
# To that end, I've created the svelte-runtime library, which includes svelte and svelte/internal
# which avoids problems (e.g. parent_component isn't defined) caused by widgets
# from different libraries using each other.

set -e

cd esmbit-dist

# Svelte internals weren't exported by default
cat svelte-runtime.js | grep -vP "^\s*export {" > .svelte.js
cat ../scripts/svelte_hacks.exports >> .svelte.js
mv .svelte.js svelte.js
rm -f svelte-runtime.js

# Rename svelte-runtime to svelte in the iomport map (needed name change during rollup -
# maybe technically all local libs should be named differently than their source libraries :hmm:)
sed -i 's,svelte-runtime,svelte,g' esmbit-import-map.json

# Rename all use of svelte/internal and svelte/store to just svelte
sed -i 's,svelte/internal,svelte,g' *.js
sed -i 's,svelte/store,svelte,g' *.js
