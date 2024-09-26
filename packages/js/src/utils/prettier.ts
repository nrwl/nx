import {
  addDependenciesToPackageJson,
  stripIndents,
  updateJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import type { Options } from 'prettier';
import { prettierVersion } from './versions';

export interface ExistingPrettierConfig {
  sourceFilepath: string;
  config: Options;
}

export async function resolveUserExistingPrettierConfig(): Promise<ExistingPrettierConfig | null> {
  let prettier: typeof import('prettier');
  try {
    prettier = require('prettier');
  } catch {
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

export function generatePrettierSetup(
  tree: Tree,
  options: { skipPackageJson?: boolean }
): GeneratorCallback {
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

  if (prettierrcNameOptions.every((name) => !tree.exists(name))) {
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
