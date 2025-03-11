import { FileReplacement } from '@nx/angular-rspack-compiler';
import {
  readCachedProjectGraph,
  type ProjectGraphProjectNode,
} from '@nx/devkit';
import assert from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
} from 'node:path';
import {
  createProjectRootMappings,
  findProjectForPath,
} from 'nx/src/project-graph/utils/find-project-for-path';
import type {
  AngularRspackPluginOptions,
  AssetElement,
  DevServerOptions,
  GlobalEntry,
  NormalizedAngularRspackPluginOptions,
  NormalizedAssetElement,
  NormalizedIndexElement,
  OutputPath,
  ScriptOrStyleEntry,
} from './angular-rspack-plugin-options';

export const INDEX_HTML_CSR = 'index.csr.html';

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
  options: AngularRspackPluginOptions
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
  // @TODO: use this once we support granular optimization options
  // const advancedOptimizations = aot && normalizedOptimization.scripts;
  const advancedOptimizations = aot && normalizedOptimization;

  const project = getProject(root);

  const assets =
    project && options.assets?.length
      ? normalizeAssetPatterns(
          options.assets,
          root,
          project.data.root,
          project.data.sourceRoot
        )
      : [];

  const globalStyles = normalizeGlobalEntries(options.styles, 'styles');
  const globalScripts = normalizeGlobalEntries(options.scripts, 'scripts');

  if (options.index === false) {
    console.warn(
      'Disabling the "index" option is not yet supported. Defaulting to "src/index.html".'
    );
    options.index = join(root, 'src/index.html');
  }

  let index: NormalizedIndexElement | undefined;
  // index can never have a value of `true` but in the schema it's of type `boolean`.
  if (typeof options.index !== 'boolean') {
    let indexOutput: string;
    // The output file will be created within the configured output path
    if (typeof options.index === 'string') {
      indexOutput = options.index;
    } else {
      if (options.index.preloadInitial) {
        console.warn(`The "index.preloadInitial" option is not yet supported.`);
      }
      if (options.index.output) {
        console.warn(`The "index.output" option is not yet supported.`);
      }

      indexOutput = options.index.output || 'index.html';
    }

    /**
     * If SSR is activated, create a distinct entry file for the `index.html`.
     * This is necessary because numerous server/cloud providers automatically serve the `index.html` as a static file
     * if it exists (handling SSG).
     *
     * For instance, accessing `foo.com/` would lead to `foo.com/index.html` being served instead of hitting the server.
     *
     * This approach can also be applied to service workers, where the `index.csr.html` is served instead of the prerendered `index.html`.
     */
    const indexBaseName = basename(indexOutput);
    indexOutput =
      // @TODO: use this once we support prerenderOptions
      // (normalizedSsr || prerenderOptions) && indexBaseName === 'index.html'
      normalizedSsr && indexBaseName === 'index.html'
        ? INDEX_HTML_CSR
        : indexBaseName;

    index = {
      input: resolve(
        root,
        typeof options.index === 'string' ? options.index : options.index.input
      ),
      output: indexOutput,
      insertionOrder: [
        ['polyfills', true],
        ...globalStyles.filter((s) => s.initial).map((s) => [s.name, false]),
        ...globalScripts.filter((s) => s.initial).map((s) => [s.name, false]),
        ['main', true],
        // [name, esm]
      ] as [string, boolean][],
      // @TODO: Add support for transformer
      transformer: undefined,
      // Preload initial defaults to true
      preloadInitial:
        typeof options.index !== 'object' ||
        (options.index.preloadInitial ?? true),
    };
  }

  return {
    index,
    browser: options.browser ?? './src/main.ts',
    ...(server ? { server } : {}),
    ...(ssr ? { ssr: normalizedSsr } : {}),
    optimization: normalizedOptimization,
    advancedOptimizations,
    polyfills: options.polyfills ?? [],
    assets,
    globalStyles,
    globalScripts,
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
    extractLicenses: options.extractLicenses ?? true,
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

function normalizeAssetPatterns(
  assets: AssetElement[],
  root: string,
  projectRoot: string,
  projectSourceRoot: string | undefined
): NormalizedAssetElement[] {
  if (assets.length === 0) {
    return [];
  }

  // When sourceRoot is not available, we default to ${projectRoot}/src.
  const sourceRoot = projectSourceRoot || join(projectRoot, 'src');
  const resolvedSourceRoot = resolve(root, sourceRoot);

  return assets.map((assetPattern) => {
    // Normalize string asset patterns to objects.
    if (typeof assetPattern === 'string') {
      const assetPath = normalize(assetPattern);
      const resolvedAssetPath = resolve(root, assetPath);

      // Check if the string asset is within sourceRoot.
      if (!resolvedAssetPath.startsWith(resolvedSourceRoot)) {
        throw new Error(
          `The ${assetPattern} asset path must start with the project source root.`
        );
      }

      let glob: string, input: string;
      let isDirectory = false;

      try {
        isDirectory = statSync(resolvedAssetPath).isDirectory();
      } catch {
        isDirectory = true;
      }

      if (isDirectory) {
        // Folders get a recursive star glob.
        glob = '**/*';
        // Input directory is their original path.
        input = assetPath;
      } else {
        // Files are their own glob.
        glob = basename(assetPath);
        // Input directory is their original dirname.
        input = dirname(assetPath);
      }

      // Output directory for both is the relative path from source root to input.
      const output = relative(resolvedSourceRoot, resolve(root, input));

      assetPattern = { glob, input, output };
    } else {
      assetPattern.output = join('.', assetPattern.output ?? '');
    }

    assert(assetPattern.output !== undefined);

    if (assetPattern.output.startsWith('..')) {
      throw new Error(
        'An asset cannot be written to a location outside of the output path.'
      );
    }

    return assetPattern as NormalizedAssetElement;
  });
}

function normalizeGlobalEntries(
  rawEntries: ScriptOrStyleEntry[] | undefined,
  _defaultName: string
): GlobalEntry[] {
  if (!rawEntries?.length) {
    return [];
  }

  const bundles = new Map<string, GlobalEntry>();

  let warnForInject = false;
  let warnForBundleName = false;
  for (const rawEntry of rawEntries) {
    let entry: ScriptOrStyleEntry;
    if (typeof rawEntry === 'string') {
      // string entries use default bundle name and inject values
      entry = { input: rawEntry };
    } else {
      entry = rawEntry;
    }

    const { bundleName, input, inject = true } = entry;

    // @TODO: remove this once we support inject
    if (inject === false) {
      warnForInject = true;
    }
    // @TODO: remove this once we support bundleName
    if (bundleName) {
      warnForBundleName = true;
    }

    // @TODO: use this once we support inject and bundleName
    // Non-injected entries default to the file name
    // const name =
    //   bundleName || (inject ? defaultName : basename(input, extname(input)));
    const name = basename(input, extname(input));

    const existing = bundles.get(name);
    if (!existing) {
      // @TODO: use this once we support inject
      // bundles.set(name, { name, files: [input], initial: inject });
      bundles.set(name, { name, files: [input], initial: true });
      continue;
    }

    // @TODO: uncomment this once we support inject
    // if (existing.initial !== inject) {
    //   throw new Error(
    //     `The "${name}" bundle is mixing injected and non-injected entries. ` +
    //       'Verify that the project options are correct.'
    //   );
    // }

    existing.files.push(input);
  }

  if (warnForInject) {
    console.warn(
      `The "inject" option for scripts/styles is not yet supported.`
    );
  }
  if (warnForBundleName) {
    console.warn(
      `The "bundleName" option for scripts/styles is not yet supported.`
    );
  }

  return [...bundles.values()];
}

function getProject(root: string): ProjectGraphProjectNode | undefined {
  if (global.NX_GRAPH_CREATION) {
    return undefined;
  }

  const projectGraph = readCachedProjectGraph();

  let projectName = process.env.NX_TASK_TARGET_PROJECT;
  if (!projectName) {
    const projectRootMappings = createProjectRootMappings(projectGraph.nodes);
    projectName = findProjectForPath(root, projectRootMappings) ?? undefined;
  }

  assert(
    projectName,
    'Cannot find the project. Please make sure to run this task with the Nx CLI and set "root" to a directory contained in a project.'
  );

  return projectGraph.nodes[projectName];
}
