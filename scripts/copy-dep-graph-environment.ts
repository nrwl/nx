import { copyFileSync } from 'fs';
import { argv } from 'yargs';

type Mode = 'dev' | 'watch';
const mode = argv._[0];

console.log(`Setting up graph for ${mode}`);

copyFileSync(
  `dep-graph/client/src/assets/environment.${mode}.js`,
  `dep-graph/client/src/assets/environment.js`
);
