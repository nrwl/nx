import { FileReplacement } from '@nx/angular-rspack-compiler';
import type {
  AngularRspackPluginOptions,
  DevServerOptions,
  NormalizedAngularRspackPluginOptions,
  OutputPath,
} from './angular-rspack-plugin-options';
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
  ssr,
}: Pick<AngularRspackPluginOptions, 'server' | 'ssr'>): boolean {
  const root = process.cwd();
  return !!(
    server &&
    ssr &&
    (ssr as { entry: string }).entry &&
    existsSync(join(root, server)) &&
    existsSync(join(root, (ssr as { entry: string }).entry))
  );
}

export function validateSsr(ssr: AngularRspackPluginOptions['ssr']) {
  if (!ssr) {
    return;
  }
  if (ssr === true) {
    throw new Error(
      'The "ssr" option should be an object or false. Please check the documentation.'
    );
  }
  if (typeof ssr === 'object')
    if (!ssr.entry) {
      throw new Error(
        'The "ssr" option should have an "entry" property. Please check the documentation.'
      );
    } else if (ssr.experimentalPlatform === 'neutral') {
      console.warn(
        'The "ssr.experimentalPlatform" option is not currently supported. Node will be used as the platform.'
      );
    }
}

export function validateOptimization(
  optimization: AngularRspackPluginOptions['optimization']
) {
  if (typeof optimization === 'boolean' || optimization === undefined) {
    return;
  }
  if (typeof optimization === 'object')
    console.warn(
      'The "optimization" option currently only supports a boolean value. Please check the documentation.'
    );
}

export function normalizeOptions(
  options: Partial<AngularRspackPluginOptions> = {}
): NormalizedAngularRspackPluginOptions {
  const { fileReplacements = [], server, ssr, optimization } = options;

  validateSsr(ssr);

  const normalizedSsr = !ssr
    ? false
    : typeof ssr === 'object'
    ? {
        entry: ssr.entry,
        experimentalPlatform: 'node' as const, // @TODO: Add support for neutral platform
      }
    : ssr;

  validateOptimization(optimization);
  const normalizedOptimization = optimization !== false; // @TODO: Add support for optimization options

  const root = process.cwd();

  const aot = options.aot ?? true;
  // @TODO: should be `aot && normalizedOptimization.scripts` once we support optimization options
  const advancedOptimizations = aot && normalizedOptimization;

  return {
    index: options.index ?? './src/index.html',
    browser: options.browser ?? './src/main.ts',
    ...(server ? { server } : {}),
    ...(ssr ? { ssr: normalizedSsr } : {}),
    optimization: normalizedOptimization,
    advancedOptimizations,
    polyfills: options.polyfills ?? [],
    assets: options.assets ?? ['./public'],
    styles: options.styles ?? ['./src/styles.css'],
    scripts: options.scripts ?? [],
    outputPath: normalizeOutputPath(root, options.outputPath),
    fileReplacements: resolveFileReplacements(fileReplacements, root),
    aot,
    outputHashing: options.outputHashing ?? 'all',
    inlineStyleLanguage: options.inlineStyleLanguage ?? 'css',
    tsConfig: options.tsConfig ?? join(root, 'tsconfig.app.json'),
    hasServer: getHasServer({ server, ssr: normalizedSsr }),
    skipTypeChecking: options.skipTypeChecking ?? false,
    useTsProjectReferences: options.useTsProjectReferences ?? false,
    devServer: normalizeDevServer(options.devServer),
  };
}

function normalizeDevServer(
  devServer: DevServerOptions | undefined
): DevServerOptions & { port: number } {
  const defaultPort = 4200;

  if (!devServer) {
    return { port: defaultPort };
  }

  return {
    ...devServer,
    port: devServer.port ?? defaultPort,
  };
}

function normalizeOutputPath(
  root: string,
  outputPath:
    | string
    | (Required<Pick<OutputPath, 'base'>> & Partial<OutputPath>)
    | undefined
): OutputPath {
  const defaultBase = join(root, 'dist');
  const defaultBrowser = join(defaultBase, 'browser');
  if (!outputPath) {
    return {
      base: defaultBase,
      browser: defaultBrowser,
      server: join(defaultBase, 'server'),
      media: join(defaultBrowser, 'media'),
    };
  }

  if (typeof outputPath === 'string') {
    if (!outputPath.startsWith(root)) {
      outputPath = join(root, outputPath);
    }
    return {
      base: outputPath,
      browser: join(outputPath, 'browser'),
      server: join(outputPath, 'server'),
      media: join(outputPath, 'browser', 'media'),
    };
  }
  if (outputPath.base && !outputPath.base.startsWith(root)) {
    outputPath.base = join(root, outputPath.base);
  }
  if (outputPath.browser && !outputPath.browser.startsWith(root)) {
    outputPath.browser = join(root, outputPath.browser);
  }
  if (outputPath.server && !outputPath.server.startsWith(root)) {
    outputPath.server = join(root, outputPath.server);
  }
  if (
    outputPath.browser &&
    !outputPath.browser.startsWith(outputPath.browser)
  ) {
    outputPath.browser = join(outputPath.browser, outputPath.browser);
  }

  const providedBase = outputPath.base ?? defaultBase;
  const providedBrowser = outputPath.browser ?? join(providedBase, 'browser');
  return {
    base: providedBase,
    browser: providedBrowser,
    server: outputPath.server ?? join(outputPath.base ?? defaultBase, 'server'),
    media: outputPath.media ?? join(providedBrowser, 'media'),
  };
}
