// TODO(chau): change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
// target: 'es2015'
import { logger, readJson, Tree, updateJson } from '@nrwl/devkit';
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
  updatePrettierRcForSwcrc(tree);
  if (tree.exists(swcrcPath)) return;
  tree.write(swcrcPath, swcOptionsString());
}

function updatePrettierRcForSwcrc(tree: Tree) {
  const prettierrcPath = '.prettierrc';
  const isExist = tree.exists(prettierrcPath);
  if (!isExist) {
    logger.info(`
For SWC, @nrwl/js:lib attempted to update Prettier Configuration for ".swcrc" file 
but the root ".prettierrc" does not exist. Please consider adding parser support for ".lib.swcrc" file
`);
    return;
  }

  try {
    const prettierRc = readJson(tree, prettierrcPath);
    const hasSwcrcOverride = prettierRc.overrides?.some((override) => {
      const files = Array.isArray(override.files)
        ? override.files
        : [override.files];
      return files.some((file) => file.includes('.swcrc'));
    });

    if (hasSwcrcOverride) return;
    updateJson(tree, prettierrcPath, (json) => {
      json.overrides = [
        ...(json.overrides ?? []),
        {
          files: '**/*.swcrc',
          options: {
            parser: 'json',
          },
        },
      ];

      return json;
    });
  } catch (e) {
    logger.error(e);
  }
}
