import { copyFileSync } from 'fs';
import { argv } from 'yargs';

type Mode = 'dev' | 'watch';
const mode = argv._[0];

console.log(`Setting up dep-graph for ${mode}`);

copyFileSync(
  `dep-graph/dep-graph/src/assets/environment.${mode}.js`,
  `dep-graph/dep-graph/src/assets/environment.js`
);
