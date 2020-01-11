import * as ts from 'typescript';
import { dirname } from 'path';

export function readTsConfig(tsConfigPath: string) {
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(tsConfigPath)
  );
}
