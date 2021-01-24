import { Options } from 'prettier';
import * as cosmiconfig from 'cosmiconfig';

export interface ExistingPrettierConfig {
  sourceFilepath: string;
  config: Options;
}

export function resolveUserExistingPrettierConfig(): Promise<ExistingPrettierConfig | null> {
  const explorer = cosmiconfig('prettier', {
    sync: true,
    cache: false,
    rcExtensions: true,
    stopDir: process.cwd(),
    transform: (result) => {
      if (result && result.config) {
        delete result.config.$schema;
      }
      return result;
    },
  });
  return Promise.resolve(explorer.load(process.cwd())).then((result) => {
    if (!result) {
      return null;
    }
    return {
      sourceFilepath: result.filepath,
      config: result.config,
    };
  });
}
