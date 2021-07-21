import { resolveConfig, resolveConfigFile } from 'prettier';
import type { Options } from 'prettier';
import { NormalModuleReplacementPlugin } from 'webpack';

export interface ExistingPrettierConfig {
  sourceFilepath: string;
  config: Options;
}

export async function resolveUserExistingPrettierConfig(): Promise<ExistingPrettierConfig | null> {
  try {
    const filepath = await resolveConfigFile();
    if (!filepath) {
      return null;
    }

    const config = await resolveConfig(process.cwd(), {
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
