// TODO(chau): change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
// target: 'es2015'
import { Tree } from '@nrwl/devkit';
import { join } from 'path';

export const defaultExclude = [
  '.*.spec.tsx?$',
  '.*.test.tsx?$',
  './src/jest-setup.ts$',
  './**/jest-setup.ts$',
  '.*.js$',
];

const swcOptionsString = () => `{
  "jsc": {
    "target": "es2017",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "decoratorMetadata": true,
      "legacyDecorator": true
    },
    "keepClassNames": true,
    "externalHelpers": true,
    "loose": true
  },
  "module": {
    "type": "commonjs",
    "strict": true,
    "noInterop": true
  },
  "sourceMaps": true,
  "exclude": ${JSON.stringify(defaultExclude)}
}`;

export function addSwcConfig(tree: Tree, projectDir: string) {
  const swcrcPath = join(projectDir, '.lib.swcrc');
  if (tree.exists(swcrcPath)) return;

  tree.write(swcrcPath, swcOptionsString());
}
