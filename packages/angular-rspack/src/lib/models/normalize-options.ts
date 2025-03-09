import { FileReplacement } from '@nx/angular-rspack-compiler';
import { AngularRspackPluginOptions } from './angular-rspack-plugin-options';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Resolves file replacement paths to absolute paths based on the provided root directory.
 *
 * @param fileReplacements - Array of file replacements with relative paths.
 * @param root - The root directory to resolve the paths against.
 * @returns Array of file replacements resolved against the root.
 */
export function resolveFileReplacements(
  fileReplacements: FileReplacement[],
  root: string
): FileReplacement[] {
  return fileReplacements.map((fileReplacement) => ({
    replace: resolve(root, fileReplacement.replace),
    with: resolve(root, fileReplacement.with),
  }));
}

export function getHasServer({
  server,
  ssrEntry,
  root,
}: Pick<AngularRspackPluginOptions, 'server' | 'ssrEntry' | 'root'>): boolean {
  return !!(
    server &&
    ssrEntry &&
    existsSync(join(root, server)) &&
    existsSync(join(root, ssrEntry))
  );
}

export function normalizeOptions(
  options: Partial<AngularRspackPluginOptions> = {}
): AngularRspackPluginOptions {
  const {
    root = process.cwd(),
    fileReplacements = [],
    server,
    ssrEntry,
  } = options;

  return {
    root,
    index: options.index ?? './src/index.html',
    browser: options.browser ?? './src/main.ts',
    ...(server ? { server } : {}),
    ...(ssrEntry ? { ssrEntry } : {}),
    polyfills: options.polyfills ?? [],
    assets: options.assets ?? ['./public'],
    styles: options.styles ?? ['./src/styles.css'],
    scripts: options.scripts ?? [],
    fileReplacements: resolveFileReplacements(fileReplacements, root),
    aot: options.aot ?? true,
    inlineStyleLanguage: options.inlineStyleLanguage ?? 'css',
    tsConfig: options.tsConfig ?? join(root, 'tsconfig.app.json'),
    hasServer: getHasServer({ server, ssrEntry, root }),
    skipTypeChecking: options.skipTypeChecking ?? false,
    useTsProjectReferences: options.useTsProjectReferences ?? false,
    devServer: options.devServer
      ? {
          ...options.devServer,
          port: options.devServer.port ?? 4200,
        }
      : {
          port: 4200,
        },
  };
}
