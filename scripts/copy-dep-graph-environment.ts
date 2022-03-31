import { copyFileSync } from 'fs';

type Mode = 'dev' | 'watch' | 'release';
const mode = process.argv[2];

console.log(`Setting up graph for ${mode}`);

try {
  copyFileSync(
    `dep-graph/client/src/assets/environment.${mode}.js`,
    `dep-graph/client/src/assets/environment.js`
  );
} catch (e) {
  console.error(e);
}
