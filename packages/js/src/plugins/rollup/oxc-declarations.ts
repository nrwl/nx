// nx-ignore-next-line
import type { OutputBundle, OutputOptions, PluginContext } from 'rollup';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';

// NOTE: This is here so we can share between `@nx/rollup` and `@nx/vite`.

function formatDeclarationError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

export interface OxcDeclarationsOptions {
  /**
   * The root directory of the project (where src/ lives).
   */
  projectRoot: string;
  /**
   * The source directory to walk for tree-shaken type-only files.
   * Defaults to `${projectRoot}/src`.
   */
  sourceRoot?: string;
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
 * A Rollup/Vite plugin that generates TypeScript declaration files (.d.ts)
 * using oxc-transform's `isolatedDeclaration` instead of the TypeScript
 * compiler.
 *
 * This is significantly faster than TSC-based declaration emission and works
 * for projects that have `isolatedDeclarations: true` in their tsconfig.
 *
 * Modeled after the oxcDtsPlugin from the Analog project.
 */
export function oxcDeclarations(options: OxcDeclarationsOptions) {
  const { projectRoot, sourcemap = false, stripInternal = false } = options;
  const sourceRoot = options.sourceRoot ?? resolve(projectRoot, 'src');

  return {
    name: 'nx-oxc-declarations',
    async writeBundle(
      this: PluginContext,
      outputOptions: OutputOptions,
      bundle: OutputBundle
    ): Promise<void> {
      const { isolatedDeclaration } = await import('oxc-transform');
      const outDir = outputOptions.dir!;

      // Phase 1: Generate .d.ts for each bundle entry chunk that has a .ts source
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.facadeModuleId) continue;

        const sourceFile = chunk.facadeModuleId;
        if (!sourceFile.endsWith('.ts') || sourceFile.endsWith('.d.ts'))
          continue;

        if (!existsSync(sourceFile)) {
          this.warn(
            [
              `Skipping declaration emit for bundle entry "${fileName}".`,
              `Source file not found: ${sourceFile}`,
              'A follow-up source-tree pass will attempt to emit the declaration.',
            ].join('\n')
          );
          continue;
        }

        try {
          const source = readFileSync(sourceFile, 'utf-8');
          const result = await isolatedDeclaration(sourceFile, source, {
            sourcemap,
            stripInternal,
          });

          if (result.code) {
            const dtsPath = join(outDir, fileName.replace(/\.js$/, '.d.ts'));
            mkdirSync(dirname(dtsPath), { recursive: true });
            writeFileSync(dtsPath, result.code);
            if (result.map && sourcemap) {
              writeFileSync(dtsPath + '.map', JSON.stringify(result.map));
            }
          }
        } catch (error) {
          this.error(
            [
              `Failed to emit declaration for bundle entry "${fileName}".`,
              `Source file: ${sourceFile}`,
              formatDeclarationError(error),
            ].join('\n')
          );
        }
      }

      // Phase 2: Generate .d.ts for type-only source files that were tree-shaken
      // from the bundle (e.g., files that only export types/interfaces).
      if (existsSync(sourceRoot)) {
        for (const tsFile of walkTs(sourceRoot)) {
          const relPath = relative(projectRoot, tsFile);
          const dtsOut = join(outDir, relPath.replace(/\.ts$/, '.d.ts'));

          // Skip if already generated in Phase 1
          if (existsSync(dtsOut)) continue;

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
            this.warn(
              [
                `Failed to emit declaration for source file "${tsFile}".`,
                `Output path: ${dtsOut}`,
                formatDeclarationError(error),
              ].join('\n')
            );
          }
        }
      }
    },
  };
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
