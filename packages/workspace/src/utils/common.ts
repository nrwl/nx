import { Rule } from '@angular-devkit/schematics';
import { Options } from 'prettier';
import * as cosmiconfig from 'cosmiconfig';

import { normalize } from '@angular-devkit/core';

export function offsetFromRoot(fullPathToSourceDir: string): string {
  const parts = normalize(fullPathToSourceDir).split('/');
  let offset = '';
  for (let i = 0; i < parts.length; ++i) {
    offset += '../';
  }
  return offset;
}

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true,
};

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
