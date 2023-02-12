import { existsSync } from 'fs';
import { ParsedCommandLine } from 'typescript';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getRootTsConfigPath } from 'nx/src/utils/typescript';
import { dirname } from 'path';

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

let tsModule: typeof import('typescript');
export function readTsConfig(tsConfigPath: string): ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    tsModule.sys,
    dirname(tsConfigPath)
  );
}
