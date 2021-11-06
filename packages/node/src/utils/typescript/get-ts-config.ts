import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  CompilerOptions,
  ParseConfigHost,
  ParsedCommandLine,
} from 'typescript';

export function getTsConfig(
  ts: typeof import('typescript'),
  projectRoot: string,
  tsConfigPath: string,
  partialOptions: Pick<
    CompilerOptions,
    'noEmit' | 'emitDeclarationOnly' | 'declaration' | 'outDir' | 'skipLibCheck'
  > = {}
): [ParsedCommandLine, CompilerOptions] {
  const config = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error('Oops! Error reading tsconfig file');
  }

  const parseConfigHost: ParseConfigHost = {
    fileExists: existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    parseConfigHost,
    resolve(projectRoot),
    partialOptions
  );

  return [
    parsed,
    {
      ...parsed.options,
      ...partialOptions,
    },
  ];
}
