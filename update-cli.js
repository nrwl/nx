const { writeFileSync, readFileSync } = require('fs');

const contents = readFileSync('./updated-cli.js', 'utf8');

writeFileSync('./node_modules/@nrwl/cli/lib/run-cli.js', contents);
