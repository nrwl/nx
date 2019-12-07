import * as ts from 'typescript';
import { virtualFs } from '@angular-devkit/core';
import { dirname } from 'path';
import { Volume } from 'memfs';
import { readFile } from 'fs';
import { appRootPath } from './app-root';

export type CompilerHostAndOptions = {
  options: ts.CompilerOptions;
  host: ts.CompilerHost;
};

export function readTsConfig(tsConfigPath: string) {
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(tsConfigPath)
  );
}

export function getTestCompilerHost(
  fileSys: { [index: string]: string },
  compilerOptions: ts.CompilerOptions
): CompilerHostAndOptions {
  const vol = Volume.fromJSON(fileSys, process.cwd());

  const getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void
  ) => {
    const sourceText = vol.readFileSync(fileName, {
      encoding: 'utf8'
    }) as string;
    return sourceText !== undefined
      ? ts.createSourceFile(fileName, sourceText, languageVersion)
      : undefined;
  };

  return {
    host: {
      getSourceFile,
      getDefaultLibFileName: () => 'lib.d.ts',
      getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
      getDirectories: path =>
        vol.readdirSync(path, { encoding: 'utf8' }) as string[],
      getCanonicalFileName: fileName =>
        ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      writeFile: (fileName, content) => vol.writeFileSync(fileName, content),
      fileExists: fileName => vol.existsSync(fileName),
      readFile: fileName =>
        vol.readFileSync(fileName, { encoding: 'utf8' }) as string,
      realpath: path => vol.realpathSync(path, { encoding: 'utf8' }) as string
    },
    options: compilerOptions
  };
}

export function getCompilerHost(): CompilerHostAndOptions {
  const configPath = ts.findConfigFile(appRootPath, ts.sys.fileExists);
  if (!configPath) {
    console.error(
      `Cannot locate a tsconfig.json. Please create one at ${appRootPath}/tsconfig.json`
    );
  }
  const config = readTsConfig(configPath);
  const options = config.options;
  const host = ts.createCompilerHost(options, true);
  return {
    host,
    options
  };
}
