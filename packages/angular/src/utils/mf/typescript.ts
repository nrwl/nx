import {
  getRootTsConfigPath,
  readTsConfig,
} from '@nrwl/workspace/src/utilities/typescript';
import { existsSync } from 'fs';
import { ParsedCommandLine } from 'typescript';

let tsConfig: ParsedCommandLine;
let tsPathMappings: ParsedCommandLine['options']['paths'];
export function readTsPathMappings(
  tsConfigPath: string = process.env.NX_TSCONFIG_PATH ?? getRootTsConfigPath()
): ParsedCommandLine['options']['paths'] {
  if (tsPathMappings) {
    return tsPathMappings;
  }

  tsConfig ??= readTsConfiguration(tsConfigPath);
  tsPathMappings = {};
  Object.entries(tsConfig.options?.paths ?? {}).forEach(([alias, paths]) => {
    tsPathMappings[alias] = paths.map((path) => path.replace(/^\.\//, ''));
  });

  return tsPathMappings;
}

function readTsConfiguration(tsConfigPath: string): ParsedCommandLine {
  if (!existsSync(tsConfigPath)) {
    throw new Error(
      `NX MF: TsConfig Path for workspace libraries does not exist! (${tsConfigPath}).`
    );
  }

  return readTsConfig(tsConfigPath);
}
