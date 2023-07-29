import {
  nxBaseCypressPreset,
  NxComponentTestingOptions,
} from '@nx/cypress/plugins/cypress-preset';
import {
  createExecutorContext,
  getProjectConfigByPath,
  getTempTailwindPath,
  isCtProjectUsingBuildProject,
} from '@nx/cypress/src/utils/ct-helpers';
import {
  ExecutorContext,
  joinPathFragments,
  logger,
  offsetFromRoot,
  parseTargetString,
  ProjectConfiguration,
  ProjectGraph,
  readCachedProjectGraph,
  readTargetOptions,
  stripIndents,
} from '@nx/devkit';
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import type { BrowserBuilderSchema } from '../src/builders/webpack-browser/schema';
import { gte } from 'semver';

/**
 * Angular nx preset for Cypress Component Testing
 *
 * This preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__filename)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used for loading project options and to construct the output paths for videos and screenshots
 * @param options override options
 */
export function nxComponentTestingPreset(
  pathToConfig: string,
  options?: NxComponentTestingOptions
) {
  let graph: ProjectGraph;
  try {
    graph = readCachedProjectGraph();
  } catch (e) {
    throw new Error(
      // don't want to strip indents so error stack has correct indentation
      `Unable to read the project graph for component testing.
This is likely due to not running via nx. i.e. 'nx component-test my-project'.
Please open an issue if this error persists.
${e.stack ? e.stack : e}`
    );
  }

  const ctProjectConfig = getProjectConfigByPath(graph, pathToConfig);
  const ctConfigurationName = process.env.NX_CYPRESS_TARGET_CONFIGURATION;
  const ctContext = createExecutorContext(
    graph,
    ctProjectConfig.targets,
    ctProjectConfig.name,
    options?.ctTargetName || 'component-test',
    ctConfigurationName
  );

  const buildTarget = getBuildableTarget(ctContext);

  if (!buildTarget.project && !graph.nodes?.[buildTarget.project]?.data) {
    throw new Error(stripIndents`Unable to find project configuration for build target. 
    Project Name? ${buildTarget.project}
    Has project config? ${!!graph.nodes?.[buildTarget.project]?.data}`);
  }

  const fromWorkspaceRoot = relative(ctContext.root, pathToConfig);
  const normalizedFromWorkspaceRootPath = lstatSync(pathToConfig).isFile()
    ? dirname(fromWorkspaceRoot)
    : fromWorkspaceRoot;
  const offset = isOffsetNeeded(ctContext, ctProjectConfig)
    ? offsetFromRoot(normalizedFromWorkspaceRootPath)
    : undefined;

  const buildContext = createExecutorContext(
    graph,
    graph.nodes[buildTarget.project]?.data.targets,
    buildTarget.project,
    buildTarget.target,
    buildTarget.configuration
  );

  const buildableProjectConfig = normalizeBuildTargetOptions(
    buildContext,
    ctContext,
    offset
  );

  return {
    ...nxBaseCypressPreset(pathToConfig, { testingType: 'component' }),
    // NOTE: cannot use a glob pattern since it will break cypress generated tsconfig.
    specPattern: ['src/**/*.cy.ts', 'src/**/*.cy.js'],
    // cypress defaults to a relative path from the workspaceRoot instead of projectRoot
    // set as absolute path in case this changes internally to cypress, this path isn't OS dependent
    indexHtmlFile: joinPathFragments(
      ctContext.root,
      ctProjectConfig.root,
      'cypress',
      'support',
      'component-index.html'
    ),
    devServer: {
      // cypress uses string union type,
      // need to use const to prevent typing to string
      ...({
        framework: 'angular',
        bundler: 'webpack',
      } as const),
      options: {
        projectConfig: buildableProjectConfig,
      },
    },
  };
}

function getBuildableTarget(ctContext: ExecutorContext) {
  const targets =
    ctContext.projectGraph.nodes[ctContext.projectName]?.data?.targets;
  const targetConfig = targets?.[ctContext.targetName];

  if (!targetConfig) {
    throw new Error(
      stripIndents`Unable to find component testing target configuration in project '${
        ctContext.projectName
      }'.
      Has targets? ${!!targets}
      Has target name? ${ctContext.targetName}
      Has ct project name? ${ctContext.projectName}
      `
    );
  }

  const cypressCtOptions = readTargetOptions(
    {
      project: ctContext.projectName,
      target: ctContext.targetName,
      configuration: ctContext.configurationName,
    },
    ctContext
  );

  if (!cypressCtOptions.devServerTarget) {
    throw new Error(
      `Unable to find the 'devServerTarget' executor option in the '${ctContext.targetName}' target of the '${ctContext.projectName}' project`
    );
  }

  return parseTargetString(
    cypressCtOptions.devServerTarget,
    ctContext.projectGraph
  );
}

function normalizeBuildTargetOptions(
  buildContext: ExecutorContext,
  ctContext: ExecutorContext,
  offset?: string
): {
  root: string;
  sourceRoot: string;
  buildOptions: BrowserBuilderSchema & { workspaceRoot: string };
} {
  const options = readTargetOptions<BrowserBuilderSchema>(
    {
      project: buildContext.projectName,
      target: buildContext.targetName,
      configuration: buildContext.configurationName,
    },
    buildContext
  );
  const buildOptions = withSchemaDefaults(options);

  // cypress creates a tsconfig if one isn't preset
  // that contains all the support required for angular and component tests
  delete buildOptions.tsConfig;

  if (offset) {
    // polyfill entries might be local files or files that are resolved from node_modules
    // like zone.js.
    // prevents error from webpack saying can't find <offset>/zone.js.
    const handlePolyfillPath = (polyfill: string) => {
      const maybeFullPath = join(ctContext.root, polyfill.split('/').join(sep));
      if (existsSync(maybeFullPath)) {
        return joinPathFragments(offset, polyfill);
      }
      return polyfill;
    };
    // paths need to be unix paths for angular devkit
    if (buildOptions.polyfills) {
      buildOptions.polyfills =
        Array.isArray(buildOptions.polyfills) &&
        buildOptions.polyfills.length > 0
          ? (buildOptions.polyfills as string[]).map((p) =>
              handlePolyfillPath(p)
            )
          : handlePolyfillPath(buildOptions.polyfills as string);
    }
    buildOptions.main = joinPathFragments(offset, buildOptions.main);
    buildOptions.index =
      typeof buildOptions.index === 'string'
        ? joinPathFragments(offset, buildOptions.index)
        : {
            ...buildOptions.index,
            input: joinPathFragments(offset, buildOptions.index.input),
          };
    buildOptions.fileReplacements = buildOptions.fileReplacements.map((fr) => {
      fr.replace = joinPathFragments(offset, fr.replace);
      fr.with = joinPathFragments(offset, fr.with);
      return fr;
    });
  }

  // if the ct project isn't being used in the build project
  // then we don't want to have the assets/scripts/styles be included to
  // prevent inclusion of unintended stuff like tailwind
  if (
    buildContext.projectName === ctContext.projectName ||
    isCtProjectUsingBuildProject(
      ctContext.projectGraph,
      buildContext.projectName,
      ctContext.projectName
    )
  ) {
    if (offset) {
      buildOptions.assets = buildOptions.assets.map((asset) => {
        return typeof asset === 'string'
          ? joinPathFragments(offset, asset)
          : { ...asset, input: joinPathFragments(offset, asset.input) };
      });
      buildOptions.styles = buildOptions.styles.map((style) => {
        return typeof style === 'string'
          ? joinPathFragments(offset, style)
          : { ...style, input: joinPathFragments(offset, style.input) };
      });
      buildOptions.scripts = buildOptions.scripts.map((script) => {
        return typeof script === 'string'
          ? joinPathFragments(offset, script)
          : { ...script, input: joinPathFragments(offset, script.input) };
      });
      if (buildOptions.stylePreprocessorOptions?.includePaths.length > 0) {
        buildOptions.stylePreprocessorOptions = {
          includePaths: buildOptions.stylePreprocessorOptions.includePaths.map(
            (path) => {
              return joinPathFragments(offset, path);
            }
          ),
        };
      }
    }
  } else {
    const stylePath = getTempStylesForTailwind(ctContext);
    buildOptions.styles = stylePath ? [stylePath] : [];
    buildOptions.assets = [];
    buildOptions.scripts = [];
    buildOptions.stylePreprocessorOptions = { includePaths: [] };
  }

  const config =
    buildContext.projectGraph.nodes[buildContext.projectName]?.data;

  if (!config.sourceRoot) {
    logger.warn(stripIndents`Unable to find the 'sourceRoot' in the project configuration.
Will set 'sourceRoot' to '${config.root}/src'
Note: this may fail, setting the correct 'sourceRoot' for ${buildContext.projectName} in the project.json file will ensure the correct value is used.`);
    config.sourceRoot = joinPathFragments(config.root, 'src');
  }

  return {
    root: offset ? joinPathFragments(offset, config.root) : config.root,
    sourceRoot: offset
      ? joinPathFragments(offset, config.sourceRoot)
      : config.sourceRoot,
    buildOptions: {
      ...buildOptions,
      // this property is only valid for cy v12.9.0+
      workspaceRoot: offset ? undefined : ctContext.root,
    },
  };
}

function withSchemaDefaults(options: any): BrowserBuilderSchema {
  if (!options.main) {
    throw new Error('Missing executor options "main"');
  }
  if (!options.index) {
    throw new Error('Missing executor options "index"');
  }
  if (!options.tsConfig) {
    throw new Error('Missing executor options "tsConfig"');
  }

  // cypress defaults aot to false so we cannot use buildOptimizer
  // otherwise the 'buildOptimizer' cannot be used without 'aot' error is thrown
  options.buildOptimizer = false;
  options.aot = false;
  options.assets ??= [];
  options.allowedCommonJsDependencies ??= [];
  options.budgets ??= [];
  options.commonChunk ??= true;
  options.crossOrigin ??= 'none';
  options.deleteOutputPath ??= true;
  options.extractLicenses ??= true;
  options.fileReplacements ??= [];
  options.inlineStyleLanguage ??= 'css';
  options.i18nDuplicateTranslation ??= 'warning';
  options.outputHashing ??= 'none';
  options.progress ??= true;
  options.scripts ??= [];

  return options;
}

/**
 * @returns a path from the workspace root to a temp file containing the base tailwind setup
 * if tailwind is being used in the project root or workspace root
 * this file should get cleaned up via the cypress executor
 */
function getTempStylesForTailwind(ctExecutorContext: ExecutorContext) {
  const ctProjectConfig = ctExecutorContext.projectGraph.nodes[
    ctExecutorContext.projectName
  ]?.data as ProjectConfiguration;
  // angular only supports `tailwind.config.{js,cjs}`
  const ctProjectTailwindConfig = join(
    ctExecutorContext.root,
    ctProjectConfig.root,
    'tailwind.config'
  );
  const exts = ['js', 'cjs'];
  const isTailWindInCtProject = exts.some((ext) =>
    existsSync(`${ctProjectTailwindConfig}.${ext}`)
  );
  const rootTailwindPath = join(ctExecutorContext.root, 'tailwind.config');
  const isTailWindInRoot = exts.some((ext) =>
    existsSync(`${rootTailwindPath}.${ext}`)
  );

  if (isTailWindInRoot || isTailWindInCtProject) {
    const pathToStyle = getTempTailwindPath(ctExecutorContext);
    try {
      mkdirSync(dirname(pathToStyle), { recursive: true });
      writeFileSync(
        pathToStyle,
        `
@tailwind base;
@tailwind components;
@tailwind utilities;
`,
        { encoding: 'utf-8' }
      );

      return pathToStyle;
    } catch (makeTmpFileError) {
      logger.warn(stripIndents`Issue creating a temp file for tailwind styles. Defaulting to no tailwind setup.
      Temp file path? ${pathToStyle}`);
      logger.error(makeTmpFileError);
    }
  }
}

function isOffsetNeeded(
  ctExecutorContext: ExecutorContext,
  ctProjectConfig: ProjectConfiguration
) {
  try {
    const { version = null } = require('cypress/package.json');

    const supportsWorkspaceRoot = !!version && gte(version, '12.9.0');

    // if using cypress <v12.9.0 then we require the offset
    if (!supportsWorkspaceRoot) {
      return true;
    }

    if (
      ctProjectConfig.projectType === 'library' &&
      // angular will only see this config if the library root is the build project config root
      // otherwise it will be set to the buildTarget root which is the app root where this config doesn't exist
      // causing tailwind styles from the libs project root to not work
      ['js', 'cjs'].some((ext) =>
        existsSync(
          join(
            ctExecutorContext.root,
            ctProjectConfig.root,
            `tailwind.config.${ext}`
          )
        )
      )
    ) {
      return true;
    }

    return false;
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      logger.error(e);
    }
    // unable to determine if we don't require an offset
    // safest to assume we do
    return true;
  }
}
