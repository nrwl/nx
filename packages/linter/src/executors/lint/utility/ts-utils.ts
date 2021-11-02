import { existsSync, readFileSync } from 'fs';
import * as ts from 'typescript';
import * as path from 'path';

/**
 * - Copied from TSLint source:
 *
 * Generic error typing for EcmaScript errors
 * Define `Error` here to avoid using `Error` from @types/node.
 * Using the `node` version causes a compilation error when this code is used as an npm library if @types/node is not already imported.
 */
declare class Error {
  public name?: string;
  public message: string;
  public stack?: string;
  constructor(message?: string);
}

/**
 * - Copied from TSLint source:
 *
 * Used to exit the program and display a friendly message without the callstack.
 */
class FatalError extends Error {
  public static NAME = 'FatalError';
  constructor(public message: string, public innerError?: Error) {
    super(message);
    this.name = FatalError.NAME;

    // Fix prototype chain for target ES5
    Object.setPrototypeOf(this, FatalError.prototype);
  }
}

/**
 * - Adapted from TSLint source:
 *
 * Creates a TypeScript program object from a tsconfig.json file path and optional project directory.
 */
export function createProgram(
  configFile: string,
  projectDirectory: string = path.dirname(configFile)
): ts.Program {
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error !== undefined) {
    throw new FatalError(
      ts.formatDiagnostics([config.error], {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: process.cwd,
        getNewLine: () => '\n',
      })
    );
  }
  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: (file) => readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    parseConfigHost,
    path.resolve(projectDirectory),
    { noEmit: true }
  );
  if (parsed.errors !== undefined) {
    // ignore warnings and 'TS18003: No inputs were found in config file ...'
    const errors = parsed.errors.filter(
      (d) => d.category === ts.DiagnosticCategory.Error && d.code !== 18003
    );
    if (errors.length !== 0) {
      throw new FatalError(
        ts.formatDiagnostics(errors, {
          getCanonicalFileName: (f) => f,
          getCurrentDirectory: process.cwd,
          getNewLine: () => '\n',
        })
      );
    }
  }
  const host = ts.createCompilerHost(parsed.options, true);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);

  return program;
}
