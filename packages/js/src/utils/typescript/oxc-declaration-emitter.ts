import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { logger } from '@nx/devkit';

export interface OxcDeclarationEmitterOptions {
  /**
   * The root directory of the project.
   */
  projectRoot: string;
  /**
   * The source directory to scan for TypeScript files.
   * Defaults to `${projectRoot}/src`.
   */
  sourceRoot?: string;
  /**
   * The output directory for generated .d.ts files.
   */
  outDir: string;
  /**
   * The root directory used for computing relative output paths.
   * Defaults to projectRoot.
   */
  rootDir?: string;
  /**
   * Whether to generate source maps for declaration files.
   * Defaults to `false`.
   */
  sourcemap?: boolean;
  /**
   * Whether to strip `@internal` JSDoc annotations from declarations.
   * Defaults to `false`.
   */
  stripInternal?: boolean;
}

/**
 * Generates TypeScript declaration files (.d.ts) for all source files in a
 * project using oxc-transform's `isolatedDeclaration`. This is a standalone
 * function that can be used by any executor (esbuild, etc.) as an alternative
 * to running the TypeScript compiler with `emitDeclarationOnly`.
 *
 * Requires `isolatedDeclarations: true` in the project's tsconfig.
 */
export async function emitOxcDeclarations(
  options: OxcDeclarationEmitterOptions
): Promise<{ errors: string[] }> {
  const {
    projectRoot,
    outDir,
    sourcemap = false,
    stripInternal = false,
  } = options;
  const sourceRoot = options.sourceRoot ?? resolve(projectRoot, 'src');
  const rootDir = options.rootDir ?? projectRoot;
  const errors: string[] = [];

  const { isolatedDeclaration } = await import('oxc-transform');

  for (const tsFile of walkTs(sourceRoot)) {
    const relPath = relative(rootDir, tsFile);
    const dtsOut = join(outDir, relPath.replace(/\.ts$/, '.d.ts'));

    try {
      const source = readFileSync(tsFile, 'utf-8');
      const result = await isolatedDeclaration(tsFile, source, {
        sourcemap,
        stripInternal,
      });

      if (result.code) {
        mkdirSync(dirname(dtsOut), { recursive: true });
        writeFileSync(dtsOut, result.code);
        if (result.map && sourcemap) {
          writeFileSync(dtsOut + '.map', JSON.stringify(result.map));
        }
      }
    } catch (error) {
      const message = `Failed to emit declaration for "${tsFile}": ${
        error instanceof Error ? error.message : String(error)
      }`;
      errors.push(message);
      logger.error(message);
    }
  }

  return { errors };
}

/**
 * Recursively walk a directory and yield all TypeScript source files,
 * skipping test files and existing declaration files.
 */
function* walkTs(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        yield* walkTs(full);
      } else if (
        full.endsWith('.ts') &&
        !full.endsWith('.spec.ts') &&
        !full.endsWith('.test.ts') &&
        !full.endsWith('.d.ts')
      ) {
        yield full;
      }
    } catch {
      // Skip files we can't stat
    }
  }
}
