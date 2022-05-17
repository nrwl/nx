import { Tree } from '@nrwl/devkit';
import { join } from 'path';

export const defaultExclude = [
  'jest.config.ts',
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
