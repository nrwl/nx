import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import {
  getProjects,
  joinPathFragments,
  logger,
  normalizePath,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import {
  normalizeLinterOption,
  getProjectSourceRoot,
  getProjectType,
  isUsingTsSolutionSetup,
} from '@nx/js/internal';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  await ensureRootProjectName(options, 'library');
  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
  });
  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  const fileName = projectNames.projectFileName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  let bundler = options.bundler ?? 'none';

  if (bundler === 'none') {
    if (options.publishable) {
      logger.warn(
        `Publishable libraries cannot be used with bundler: 'none'. Defaulting to 'rollup'.`
      );
      bundler = 'rollup';
    }
    if (options.buildable) {
      logger.warn(
        `Buildable libraries cannot be used with bundler: 'none'. Defaulting to 'rollup'.`
      );
      bundler = 'rollup';
    }
  }

  let appMain: string | undefined;
  let appSourceRoot: string | undefined;

  if (options.appProject) {
    const appProjectConfig = getProjects(host).get(options.appProject);
    const appProjectType = getProjectType(
      host,
      appProjectConfig.root,
      appProjectConfig.projectType
    );

    if (appProjectType !== 'application') {
      throw new Error(
        `appProject expected type of "application" but got "${appProjectType}"`
      );
    }

    appMain =
      appProjectConfig.targets.build?.options?.main ??
      findMainEntry(host, appProjectConfig.root);
    appSourceRoot = normalizePath(getProjectSourceRoot(appProjectConfig, host));

    // TODO(jack): We should use appEntryFile instead of appProject so users can directly set it rather than us inferring it.
    if (!appMain) {
      throw new Error(
        `Could not locate project main for ${options.appProject}`
      );
    }
  }

  assertValidStyle(options.style);

  const normalized: NormalizedSchema = {
    ...options,
    compiler: options.compiler ?? 'babel',
    bundler,
    fileName,
    routePath: `/${projectNames.projectSimpleName}`,
    name: isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    projectRoot,
    parsedTags,
    importPath,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    isUsingTsSolutionConfig,
    js: options.js ?? false,
    unitTestRunner: options.unitTestRunner ?? 'none',
    // Libraries with a bundler or that are publishable must also be buildable.
    buildable: Boolean(
      bundler !== 'none' || options.buildable || options.publishable
    ),
    appMain,
    appSourceRoot,
    // The React-specific ESLint shaping is guarded on `=== 'eslint'`, so an
    // unresolved `undefined` would create a bare config with none of it.
    linter: await normalizeLinterOption(host, options.linter),
  };

  return normalized;
}

function findMainEntry(tree: Tree, projectRoot: string): string | undefined {
  const mainFiles = [
    // These are the main files we generate with.
    'src/main.ts',
    'src/main.tsx',
    'src/main.js',
    'src/main.jsx',
    // Other options just in case
    'src/index.ts',
    'src/index.tsx',
    'src/index.js',
    'src/index.jsx',
    'main.ts',
    'main.tsx',
    'main.js',
    'main.jsx',
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
  ];
  const mainEntry = mainFiles.find((file) =>
    tree.exists(joinPathFragments(projectRoot, file))
  );
  return mainEntry ? joinPathFragments(projectRoot, mainEntry) : undefined;
}
