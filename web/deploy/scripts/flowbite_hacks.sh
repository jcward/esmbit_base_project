#!/bin/sh

# namespace all rules, requires .flowbite container
node scripts/prefix_css_rule.cjs .flowbite-scope esmbit-dist/flowbite.css esmbit-dist/flowbite.css

# we can't add a class to these, it makes the selector priority too high
sed -i 's,.flowbite-scope \*,*,' esmbit-dist/flowbite.css
sed -i 's,.flowbite-scope ::before,::before,' esmbit-dist/flowbite.css
sed -i 's,.flowbite-scope ::after,::after,' esmbit-dist/flowbite.css

sed -i 's,^html,html.flowbite-scope,' esmbit-dist/flowbite.css
sed -i 's,^body,body.flowbite-scope,' esmbit-dist/flowbite.css
