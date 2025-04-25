import { getSupportedBrowsers } from '@angular/build/private';
import type { FileReplacement } from '@nx/angular-rspack-compiler';
import { workspaceRoot, type ProjectGraphProjectNode } from '@nx/devkit';
import assert from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  posix,
  relative,
  resolve,
} from 'node:path';
import {
  findProjectForPath,
  normalizeProjectRoot,
} from '../utils/find-project-for-path';
import { retrieveOrCreateProjectGraph } from '../utils/graph';
import type {
  AngularRspackPluginOptions,
  AssetElement,
  DevServerOptions,
  GlobalEntry,
  NormalizedAngularRspackPluginOptions,
  NormalizedAssetElement,
  NormalizedDevServerOptions,
  NormalizedIndexElement,
  OutputPath,
  ScriptOrStyleEntry,
  SourceMap,
} from './angular-rspack-plugin-options';
import {
  DEV_SERVER_OPTIONS_PENDING_SUPPORT,
  TOP_LEVEL_OPTIONS_PENDING_SUPPORT,
} from './unsupported-options';

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

export function getHasServer(
  root: string,
  server: string | undefined,
  ssr: AngularRspackPluginOptions['ssr']
): boolean {
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

function validateGeneralUnsupportedOptions(
  options: AngularRspackPluginOptions
) {
  const topLevelUnsupportedOptions = TOP_LEVEL_OPTIONS_PENDING_SUPPORT.filter(
    (option) => options[option] !== undefined
  ).sort();
  const devServerUnsupportedOptions = DEV_SERVER_OPTIONS_PENDING_SUPPORT.filter(
    (option) => options.devServer?.[option] !== undefined
  ).sort();

  const unsupportedOptions = [
    ...topLevelUnsupportedOptions.map((option) => `"${option}"`),
    ...devServerUnsupportedOptions.map((option) => `"devServer.${option}"`),
  ];

  if (unsupportedOptions.length > 0) {
    console.warn(
      `The following options are not yet supported:\n  ${unsupportedOptions.join(
        '\n  '
      )}\n`
    );
  }
}

export async function normalizeOptions(
  options: AngularRspackPluginOptions
): Promise<NormalizedAngularRspackPluginOptions> {
  validateGeneralUnsupportedOptions(options);

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

  const root = options.root ?? process.cwd();
  const tsConfig = options.tsConfig
    ? resolve(root, options.tsConfig)
    : join(root, 'tsconfig.app.json');

  const aot = options.aot ?? true;
  // @TODO: use this once we support granular optimization options
  // const advancedOptimizations = aot && normalizedOptimization.scripts;
  const advancedOptimizations = aot && normalizedOptimization;

  const project = await getProject(root);

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
  } else if (!options.index) {
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
    // @TODO: use this once we properly support SSR/SSG options
    // (normalizedSsr || prerenderOptions) && indexBaseName === 'index.html'
    //   ? INDEX_HTML_CSR
    //   : indexBaseName;
    indexOutput = indexBaseName;

    const entryPoints: [name: string, isEsm: boolean][] = [
      // TODO: this should be true when !!devServer?.hot (HMR is supported)
      ['runtime', false],
      ['polyfills', true],
      ...(globalStyles.filter((s) => s.initial).map((s) => [s.name, false]) as [
        string,
        boolean
      ][]),
      ...(globalScripts
        .filter((s) => s.initial)
        .map((s) => [s.name, false]) as [string, boolean][]),
      ['vendor', true],
      ['main', true],
    ];

    const duplicates = entryPoints.filter(
      ([name]) =>
        entryPoints[0].indexOf(name) !== entryPoints[0].lastIndexOf(name)
    );

    if (duplicates.length > 0) {
      throw new Error(
        `Multiple bundles have been named the same: '${duplicates.join(
          `', '`
        )}'.`
      );
    }

    index = {
      input: resolve(
        root,
        typeof options.index === 'string' ? options.index : options.index.input
      ),
      output: indexOutput,
      // @TODO: Add support for transformer
      transformer: undefined,
      // Preload initial defaults to true
      preloadInitial:
        typeof options.index !== 'object' ||
        (options.index.preloadInitial ?? true),
    };
  }

  return {
    advancedOptimizations,
    assets,
    aot,
    baseHref: options.baseHref,
    browser: options.browser ?? './src/main.ts',
    commonChunk: options.commonChunk ?? true,
    crossOrigin: options.crossOrigin ?? 'none',
    define: options.define ?? {},
    deleteOutputPath: options.deleteOutputPath ?? true,
    deployUrl: options.deployUrl,
    devServer: normalizeDevServer(options.devServer),
    externalDependencies: options.externalDependencies ?? [],
    extractLicenses: options.extractLicenses ?? true,
    fileReplacements: resolveFileReplacements(fileReplacements, root),
    globalStyles,
    globalScripts,
    hasServer: getHasServer(root, server, normalizedSsr),
    index,
    inlineStyleLanguage: options.inlineStyleLanguage ?? 'css',
    namedChunks: options.namedChunks ?? false,
    optimization: normalizedOptimization,
    outputHashing: options.outputHashing ?? 'none',
    outputPath: normalizeOutputPath(root, options.outputPath),
    polyfills: options.polyfills ?? [],
    projectName: project?.name ?? undefined,
    root,
    serviceWorker: options.serviceWorker,
    ngswConfigPath: options.ngswConfigPath,
    server,
    skipTypeChecking: options.skipTypeChecking ?? false,
    sourceMap: normalizeSourceMap(options.sourceMap),
    ssr: normalizedSsr,
    subresourceIntegrity: options.subresourceIntegrity ?? false,
    supportedBrowsers: getSupportedBrowsers(root, { warn: console.warn }),
    tsConfig,
    useTsProjectReferences: options.useTsProjectReferences ?? false,
    vendorChunk: options.vendorChunk ?? false,
  };
}

function normalizeSourceMap(
  sourceMap: boolean | Partial<SourceMap> | undefined
): SourceMap {
  if (sourceMap === undefined) {
    return {
      scripts: false,
      styles: false,
      hidden: false,
      vendor: false,
    };
  }

  if (typeof sourceMap === 'boolean') {
    return {
      scripts: sourceMap,
      styles: sourceMap,
      hidden: sourceMap,
      vendor: sourceMap,
    };
  }

  return {
    scripts: sourceMap.scripts ?? true,
    styles: sourceMap.styles ?? true,
    hidden: sourceMap.hidden ?? false,
    vendor: sourceMap.vendor ?? false,
  };
}

function normalizeDevServer(
  devServer: DevServerOptions | undefined
): NormalizedDevServerOptions {
  const defaultHost = 'localhost';
  const defaultPort = 4200;

  if (!devServer) {
    return {
      allowedHosts: [],
      host: defaultHost,
      port: defaultPort,
    };
  }

  return {
    ...devServer,
    allowedHosts: devServer.allowedHosts ?? [],
    host: devServer.host ?? defaultHost,
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
  let base =
    typeof outputPath === 'string' ? outputPath : outputPath?.base ?? 'dist';
  if (!base.startsWith(root)) {
    base = join(root, base);
  }

  const browser =
    typeof outputPath === 'string' || !outputPath?.browser
      ? join(base, 'browser')
      : join(base, outputPath.browser);
  const server =
    typeof outputPath === 'string' || !outputPath?.server
      ? join(base, 'server')
      : join(base, outputPath.server);
  const media =
    typeof outputPath === 'string' || !outputPath?.media
      ? join(browser, 'media')
      : join(browser, outputPath.media);

  return { base, browser, server, media };
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
  const resolvedSourceRoot = projectSourceRoot
    ? join(workspaceRoot, projectSourceRoot)
    : join(workspaceRoot, projectRoot, 'src');

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
  defaultName: string
): GlobalEntry[] {
  if (!rawEntries?.length) {
    return [];
  }

  const bundles = new Map<string, GlobalEntry>();

  for (const rawEntry of rawEntries) {
    let entry: ScriptOrStyleEntry;
    if (typeof rawEntry === 'string') {
      // string entries use default bundle name and inject values
      entry = { input: rawEntry };
    } else {
      entry = rawEntry;
    }

    const { bundleName, input, inject = true } = entry;

    // Non-injected entries default to the file name
    const name =
      bundleName || (inject ? defaultName : basename(input, extname(input)));

    const existing = bundles.get(name);
    if (!existing) {
      bundles.set(name, { name, files: [input], initial: inject });
      continue;
    }

    if (existing.initial !== inject) {
      throw new Error(
        `The "${name}" bundle is mixing injected and non-injected entries. ` +
          'Verify that the project options are correct.'
      );
    }

    existing.files.push(input);
  }

  return [...bundles.values()];
}

async function getProject(
  root: string
): Promise<ProjectGraphProjectNode | undefined> {
  if (global.NX_GRAPH_CREATION) {
    return undefined;
  }

  const projectGraph = await retrieveOrCreateProjectGraph();
  assert(
    projectGraph,
    'Cannot find the project. Please make sure to run this task with the Nx CLI and set "root" to a directory contained in a project.'
  );

  let projectName = process.env.NX_TASK_TARGET_PROJECT;
  if (!projectName) {
    const projectRootMappings = createProjectRootMappings(projectGraph.nodes);
    projectName =
      findProjectForPath(
        posix.relative(workspaceRoot, root),
        projectRootMappings
      ) ?? undefined;
  }

  assert(
    projectName,
    'Cannot find the project. Please make sure to run this task with the Nx CLI and set "root" to a directory contained in a project.'
  );

  return projectGraph.nodes[projectName];
}

function createProjectRootMappings(
  nodes: Record<string, ProjectGraphProjectNode>
): Map<string, string> {
  const projectRootMappings = new Map<string, string>();
  for (const projectName of Object.keys(nodes)) {
    const root = nodes[projectName].data.root;

    projectRootMappings.set(normalizeProjectRoot(root), projectName);
  }
  return projectRootMappings;
}
