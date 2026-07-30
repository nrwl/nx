import {
  addDependenciesToPackageJson,
  readJson,
  stripIndents,
  updateJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
  logger,
} from '@nx/devkit';
import { prettierConfigFiles } from 'nx/src/devkit-internals';
import type { Options } from 'prettier';
import { prettierVersion } from './versions';

export interface ExistingPrettierConfig {
  sourceFilepath: string;
  config: Options;
}

// Prettier v3 (ESM) exposes its API as named exports; v2 (CJS) exposes it under
// `.default` when loaded via `import()`. Return whichever carries the API, or
// null if prettier isn't installed.
async function importPrettier(): Promise<typeof import('prettier') | null> {
  try {
    const imported = await import('prettier');
    return (
      (imported as any).resolveConfig ? imported : (imported as any).default
    ) as typeof import('prettier');
  } catch {
    return null;
  }
}

export async function resolveUserExistingPrettierConfig(): Promise<ExistingPrettierConfig | null> {
  const prettier = await importPrettier();
  if (!prettier) {
    return null;
  }

  try {
    const filepath = await prettier.resolveConfigFile();
    if (!filepath) {
      return null;
    }

    const config = await prettier.resolveConfig(process.cwd(), {
      useCache: false,
      config: filepath,
    });
    if (!config) {
      return null;
    }

    return {
      sourceFilepath: filepath,
      config: config,
    };
  } catch {
    return null;
  }
}

// A copy of nx's `prettierConfigFiles`, used only when the installed nx is too
// old to export it. Kept whole so the "never write a second config" invariant
// survives the fallback.
const PRETTIER_CONFIG_FILES_FALLBACK = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  'prettier.config.js',
  '.prettierrc.ts',
  'prettier.config.ts',
  '.prettierrc.mjs',
  'prettier.config.mjs',
  '.prettierrc.mts',
  'prettier.config.mts',
  '.prettierrc.cjs',
  'prettier.config.cjs',
  '.prettierrc.cts',
  'prettier.config.cts',
  '.prettierrc.toml',
];

export function generatePrettierSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
  // Imported rather than copied, for the same reason as the oxfmt list:
  // detection and setup have to agree, or a workspace whose config format is
  // missing from this copy gets a second, redundant `.prettierrc` written next
  // to the one it already has. This copy was missing the `.ts`/`.mts`/`.cts`
  // forms.
  // `prettierConfigFiles` is new in this nx. `@nx/js` has no `nx` peer of its own, so it
  // inherits devkit's and can be paired with an nx that does not export it.
  // The fallback repeats the *whole* list rather than the canonical name:
  // a one-name fallback would miss an existing config under any other name
  // and write a second one - which for oxfmt is not redundant but fatal
  // ("Both '<a>' and '<b>' found"), and for prettier silently outranks the
  // user's own file.
  const configFiles = prettierConfigFiles ?? PRETTIER_CONFIG_FILES_FALLBACK;
  if (!prettierConfigFiles) {
    logger.warn(
      `This @nx/js is paired with an nx that does not export \`prettierConfigFiles\`; using a built-in list. Align the nx and @nx/js versions if a duplicate prettier config appears.`
    );
  }
  if (configFiles.every((name) => !tree.exists(name))) {
    writeJson(tree, '.prettierrc', { singleQuote: true });
  }

  if (!tree.exists('.prettierignore')) {
    tree.write(
      '.prettierignore',
      stripIndents`# Add files here to ignore them from prettier formatting
        /dist
        /coverage
        /.nx/cache
        /.nx/workspace-data
      `
    );
  }

  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ??= [];
      const extension = 'esbenp.prettier-vscode';
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
      return json;
    });
  }

  return options.skipPackageJson
    ? () => {}
    : addDependenciesToPackageJson(tree, {}, { prettier: prettierVersion });
}

export async function resolvePrettierConfigPath(
  tree: Tree
): Promise<string | null> {
  const prettier = await importPrettier();
  if (!prettier) {
    return null;
  }

  const configFilePath = await prettier.resolveConfigFile();
  if (configFilePath) {
    return configFilePath;
  }

  if (!tree) {
    return null;
  }

  // if we haven't find a config file in the file system, we try to find it in the virtual tree
  // https://prettier.io/docs/en/configuration.html
  const prettierrcNameOptions = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.json5',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
  ];

  const filePath = prettierrcNameOptions.find((file) => tree.exists(file));
  if (filePath) {
    return filePath;
  }

  // check the package.json file
  const packageJson = readJson(tree, 'package.json');
  if (packageJson.prettier) {
    return 'package.json';
  }

  // check the package.yaml file
  if (tree.exists('package.yaml')) {
    const { load } = await import('@zkochan/js-yaml');
    const packageYaml = load(tree.read('package.yaml', 'utf-8'));
    if (packageYaml.prettier) {
      return 'package.yaml';
    }
  }

  return null;
}
