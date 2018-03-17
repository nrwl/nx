import { Tree, Rule } from '@angular-devkit/schematics';
import { readdirSync, readFileSync } from 'fs';
import { Options } from 'prettier';
import * as cosmiconfig from 'cosmiconfig';

import { angularJsVersion } from '../lib-versions';
import { serializeJson } from './fileutils';
import { Schema } from '../collection/app/schema';

export function addUpgradeToPackageJson(): Rule {
  return (host: Tree) => {
    if (!host.exists('package.json')) return host;

    const sourceText = host.read('package.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    if (!json['dependencies']) {
      json['dependencies'] = {};
    }

    if (!json['dependencies']['@angular/upgrade']) {
      json['dependencies']['@angular/upgrade'] =
        json['dependencies']['@angular/core'];
    }
    if (!json['dependencies']['angular']) {
      json['dependencies']['angular'] = angularJsVersion;
    }

    host.overwrite('package.json', serializeJson(json));
    return host;
  };
}

export function offsetFromRoot(fullPathToSourceDir: string): string {
  const parts = fullPathToSourceDir.split('/');
  let offset = '';
  for (let i = 0; i < parts.length; ++i) {
    offset += '../';
  }
  return offset;
}

export const DEFAULT_NRWL_PRETTIER_CONFIG = {
  singleQuote: true
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
    transform: result => {
      if (result && result.config) {
        delete result.config.$schema;
      }
      return result;
    }
  });
  return Promise.resolve(explorer.load(process.cwd())).then(result => {
    if (!result) {
      return null;
    }
    return {
      sourceFilepath: result.filepath,
      config: result.config
    };
  });
}
