import type { Options } from 'prettier';

let prettier: typeof import('prettier');
try {
  prettier = require('prettier');
} catch {}

export interface ExistingPrettierConfig {
  sourceFilepath: string;
  config: Options;
}

export async function resolveUserExistingPrettierConfig(): Promise<ExistingPrettierConfig | null> {
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
