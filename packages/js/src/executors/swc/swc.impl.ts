import { ExecutorContext, readJsonFile, writeJsonFile } from '@nx/devkit';
import { assetGlobsToFiles, FileInputOutput } from '../../utils/assets/assets';
import { removeSync } from 'fs-extra';
import { dirname, join, relative, resolve } from 'path';
import { copyAssets } from '../../utils/assets';
import { checkDependencies } from '../../utils/check-dependencies';
import {
  getHelperDependency,
  HelperDependency,
} from '../../utils/compiler-helper-dependency';
import {
  handleInliningBuild,
  isInlineGraphEmpty,
  postProcessInlinedDependencies,
} from '../../utils/inline';
import { copyPackageJson } from '../../utils/package-json';
import {
  NormalizedSwcExecutorOptions,
  SwcExecutorOptions,
} from '../../utils/schema';
import { compileSwc, compileSwcWatch } from '../../utils/swc/compile-swc';
import { getSwcrcPath } from '../../utils/swc/get-swcrc-path';
import { generateTmpSwcrc } from '../../utils/swc/inline';
import type { Options } from '@swc/core';

export function normalizeOptions(
  options: SwcExecutorOptions,
  contextRoot: string,
  sourceRoot?: string,
  projectRoot?: string
): NormalizedSwcExecutorOptions {
  const outputPath = join(contextRoot, options.outputPath);

  if (options.skipTypeCheck == null) {
    options.skipTypeCheck = false;
  }

  if (options.watch == null) {
    options.watch = false;
  }

  // TODO: put back when inlining story is more stable
  // if (options.external == null) {
  //   options.external = 'all';
  // } else if (Array.isArray(options.external) && options.external.length === 0) {
  //   options.external = 'none';
  // }

  if (Array.isArray(options.external) && options.external.length > 0) {
    const firstItem = options.external[0];
    if (firstItem === 'all' || firstItem === 'none') {
      options.external = firstItem;
    }
  }

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    contextRoot,
    outputPath
  );

  const projectRootParts = projectRoot.split('/');
  // We pop the last part of the `projectRoot` to pass
  // the last part (projectDir) and the remainder (projectRootParts) to swc
  const projectDir = projectRootParts.pop();
  // default to current directory if projectRootParts is [].
  // Eg: when a project is at the root level, outside of layout dir
  const swcCwd = projectRootParts.join('/') || '.';
  const swcrcPath = getSwcrcPath(options, contextRoot, projectRoot);

  const swcCliOptions = {
    srcPath: projectDir,
    destPath: relative(join(contextRoot, swcCwd), outputPath),
    swcCwd,
    swcrcPath,
  };

  return {
    ...options,
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
    files,
    root: contextRoot,
    sourceRoot,
    projectRoot,
    originalProjectRoot: projectRoot,
    outputPath,
    tsConfig: join(contextRoot, options.tsConfig),
    swcCliOptions,
  } as NormalizedSwcExecutorOptions;
}

export async function* swcExecutor(
  _options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } =
    context.projectsConfigurations.projects[context.projectName];
  const options = normalizeOptions(_options, context.root, sourceRoot, root);
  const { tmpTsConfig, dependencies } = checkDependencies(
    context,
    options.tsConfig
  );

  if (tmpTsConfig) {
    options.tsConfig = tmpTsConfig;
  }

  const swcHelperDependency = getHelperDependency(
    HelperDependency.swc,
    options.swcCliOptions.swcrcPath,
    dependencies,
    context.projectGraph
  );

  if (swcHelperDependency) {
    dependencies.push(swcHelperDependency);
  }

  const inlineProjectGraph = handleInliningBuild(
    context,
    options,
    options.tsConfig
  );

  if (!isInlineGraphEmpty(inlineProjectGraph)) {
    options.projectRoot = '.'; // set to root of workspace to include other libs for type check

    // remap paths for SWC compilation
    options.swcCliOptions.srcPath = options.swcCliOptions.swcCwd;
    options.swcCliOptions.swcCwd = '.';
    options.swcCliOptions.destPath = options.swcCliOptions.destPath
      .split('../')
      .at(-1)
      .concat('/', options.swcCliOptions.srcPath);

    // tmp swcrc with dependencies to exclude
    // - buildable libraries
    // - other libraries that are not dependent on the current project
    options.swcCliOptions.swcrcPath = generateTmpSwcrc(
      inlineProjectGraph,
      options.swcCliOptions.swcrcPath
    );
  }

  if (options.watch) {
    let disposeFn: () => void;
    process.on('SIGINT', () => disposeFn());
    process.on('SIGTERM', () => disposeFn());

    return yield* compileSwcWatch(context, options, async () => {
      const assetResult = await copyAssets(options, context);
      const packageJsonResult = await copyPackageJson(
        {
          ...options,
          skipTypings: !options.skipTypeCheck,
        },
        context
      );
      removeTmpSwcrc(options.swcCliOptions.swcrcPath);
      disposeFn = () => {
        assetResult?.stop();
        packageJsonResult?.stop();
      };
    });
  } else {
    return yield compileSwc(context, options, async () => {
      await copyAssets(options, context);
      await copyPackageJson(
        {
          ...options,
          generateExportsField: true,
          skipTypings: !options.skipTypeCheck,
          extraDependencies: swcHelperDependency ? [swcHelperDependency] : [],
        },
        context
      );
      removeTmpSwcrc(options.swcCliOptions.swcrcPath);
      postProcessInlinedDependencies(
        options.outputPath,
        options.originalProjectRoot,
        inlineProjectGraph
      );
    });
  }
}

function removeTmpSwcrc(swcrcPath: string) {
  if (swcrcPath.includes('tmp/') && swcrcPath.includes('.generated.swcrc')) {
    removeSync(dirname(swcrcPath));
  }
}

export default swcExecutor;
