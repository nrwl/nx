import { type Tree } from '@nx/devkit';
import { join } from 'path';

export const defaultExclude = [
  'jest.config.ts',
  '.*\\.spec.tsx?$',
  '.*\\.test.tsx?$',
  './src/jest-setup.ts$',
  './**/jest-setup.ts$',
  '.*.js$',
];

const swcOptionsString = (
  type: 'commonjs' | 'es6' = 'commonjs',
  exclude: string[],
  supportTsx: boolean
) => `{
  "jsc": {
    "target": "es2017",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true${
        supportTsx
          ? `,
      "tsx": true`
          : ''
      }
    },
    "transform": {
      "decoratorMetadata": true,
      "legacyDecorator": true${
        supportTsx
          ? `,
      "react": {
        "runtime": "automatic"
      }`
          : ''
      }
    },
    "keepClassNames": true,
    "externalHelpers": true,
    "loose": true
  },
  "module": {
    "type": "${type}"
  },
  "sourceMaps": true,
  "exclude": ${JSON.stringify(exclude)}
}
`;

export function addSwcConfig(
  tree: Tree,
  projectDir: string,
  type: 'commonjs' | 'es6' = 'commonjs',
  supportTsx: boolean = false,
  swcName: string = '.swcrc',
  additionalExcludes: string[] = []
) {
  const swcrcPath = join(projectDir, swcName);
  if (tree.exists(swcrcPath)) return;
  tree.write(
    swcrcPath,
    swcOptionsString(
      type,
      [...defaultExclude, ...additionalExcludes],
      supportTsx
    )
  );
}

export function addSwcTestConfig(
  tree: Tree,
  projectDir: string,
  type: 'commonjs' | 'es6' = 'commonjs',
  supportTsx: boolean = false
) {
  const swcrcPath = join(projectDir, '.spec.swcrc');
  if (tree.exists(swcrcPath)) return;
  tree.write(swcrcPath, swcOptionsString(type, [], supportTsx));
}
