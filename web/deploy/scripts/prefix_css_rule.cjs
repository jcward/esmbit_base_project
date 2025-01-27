const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const prefixSelector = require('postcss-prefix-selector');

if (process.argv.length < 5) {
    console.error('Usage: node prefix_css.js .flowbite <input.css> <output.css>');
    process.exit(1);
}

const prefix = process.argv[2];
const inputFile = process.argv[3];
const outputFile = process.argv[4];

// Read the input CSS file
fs.readFile(inputFile, 'utf8', (err, css) => {
    if (err) {
        console.error(`Error reading file ${inputFile}:`, err.message);
        process.exit(1);
    }

    // Process the CSS to add the prefix
    postcss([
        prefixSelector({
            prefix,
            exclude: ['html', 'body'], // Exclude global selectors if needed
        }),
    ])
        .process(css, { from: inputFile, to: outputFile })
        .then((result) => {
            // Write the processed CSS to the output file
            fs.writeFile(outputFile, result.css, (writeErr) => {
                if (writeErr) {
                    console.error(`Error writing file ${outputFile}:`, writeErr.message);
                    process.exit(1);
                }
                console.log(`Prefixed CSS written to ${outputFile}`);
            });
        })
        .catch((processErr) => {
            console.error('Error processing CSS:', processErr.message);
            process.exit(1);
        });
});
