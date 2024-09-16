import { ExecutorContext, readJsonFile } from '@nx/devkit';
import { assetGlobsToFiles, FileInputOutput } from '../../utils/assets/assets';
import { sync as globSync } from 'fast-glob';
import { rmSync } from 'node:fs';
import { dirname, join, relative, resolve, normalize } from 'path';
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
  SwcCliOptions,
  SwcExecutorOptions,
} from '../../utils/schema';
import { compileSwc, compileSwcWatch } from '../../utils/swc/compile-swc';
import { getSwcrcPath } from '../../utils/swc/get-swcrc-path';
import { generateTmpSwcrc } from '../../utils/swc/inline';

function normalizeOptions(
  options: SwcExecutorOptions,
  root: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedSwcExecutorOptions {
  const outputPath = join(root, options.outputPath);

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
    root,
    outputPath
  );

  // Always execute from root of project, same as with SWC CLI.
  const swcCwd = join(root, projectRoot);
  const { swcrcPath, tmpSwcrcPath } = getSwcrcPath(options, root, projectRoot);

  const swcCliOptions = {
    srcPath: projectRoot,
    destPath: relative(swcCwd, outputPath),
    swcCwd,
    swcrcPath,
    stripLeadingPaths: Boolean(options.stripLeadingPaths),
  };

  return {
    ...options,
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
    files,
    root,
    sourceRoot,
    projectRoot,
    originalProjectRoot: projectRoot,
    outputPath,
    tsConfig: join(root, options.tsConfig),
    swcCliOptions,
    tmpSwcrcPath,
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
    if (options.stripLeadingPaths) {
      throw new Error(`Cannot use --strip-leading-paths with inlining.`);
    }

    options.projectRoot = '.'; // set to root of workspace to include other libs for type check

    // remap paths for SWC compilation
    options.inline = true;
    options.swcCliOptions.swcCwd = '.';
    options.swcCliOptions.srcPath = options.swcCliOptions.swcCwd;
    options.swcCliOptions.destPath = join(
      options.swcCliOptions.destPath.split(normalize('../')).at(-1),
      options.swcCliOptions.srcPath
    );

    // tmp swcrc with dependencies to exclude
    // - buildable libraries
    // - other libraries that are not dependent on the current project
    options.swcCliOptions.swcrcPath = generateTmpSwcrc(
      inlineProjectGraph,
      options.swcCliOptions.swcrcPath,
      options.tmpSwcrcPath
    );
  }

  function determineModuleFormatFromSwcrc(
    absolutePathToSwcrc: string
  ): 'cjs' | 'esm' {
    const swcrc = readJsonFile(absolutePathToSwcrc);
    return swcrc.module?.type?.startsWith('es') ? 'esm' : 'cjs';
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
          additionalEntryPoints: createEntryPoints(options, context),
          format: [
            determineModuleFormatFromSwcrc(options.swcCliOptions.swcrcPath),
          ],
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
          additionalEntryPoints: createEntryPoints(options, context),
          format: [
            determineModuleFormatFromSwcrc(options.swcCliOptions.swcrcPath),
          ],
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
  if (
    swcrcPath.includes(normalize('tmp/')) &&
    swcrcPath.includes('.generated.swcrc')
  ) {
    rmSync(dirname(swcrcPath), { recursive: true, force: true });
  }
}

function createEntryPoints(
  options: { additionalEntryPoints?: string[] },
  context: ExecutorContext
): string[] {
  if (!options.additionalEntryPoints?.length) return [];
  return globSync(options.additionalEntryPoints, {
    cwd: context.root,
  });
}

export default swcExecutor;
