import { ExecutorContext, readJsonFile } from '@nx/devkit';
import { rmSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'path';
import { globSync } from 'tinyglobby';
import { copyAssets } from '../../utils/assets';
import { assetGlobsToFiles, FileInputOutput } from '../../utils/assets/assets';
import type { DependentBuildableProjectNode } from '../../utils/buildable-libs-utils';
import { checkDependencies } from '../../utils/check-dependencies';
import {
  getHelperDependency,
  HelperDependency,
} from '../../utils/compiler-helper-dependency';
import {
  copyPackageJson,
  type CopyPackageJsonResult,
} from '../../utils/package-json';
import {
  NormalizedSwcExecutorOptions,
  SwcExecutorOptions,
} from '../../utils/schema';
import { compileSwc, compileSwcWatch } from '../../utils/swc/compile-swc';
import { getSwcrcPath } from '../../utils/swc/get-swcrc-path';
import { isUsingTsSolutionSetup } from '../../utils/typescript/ts-solution-setup';

function normalizeOptions(
  options: SwcExecutorOptions,
  root: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedSwcExecutorOptions {
  const isTsSolutionSetup = isUsingTsSolutionSetup();
  if (isTsSolutionSetup) {
    if (options.generateLockfile) {
      throw new Error(
        `Setting 'generateLockfile: true' is not supported with the current TypeScript setup. Unset the 'generateLockfile' option and try again.`
      );
    }
    if (options.generateExportsField) {
      throw new Error(
        `Setting 'generateExportsField: true' is not supported with the current TypeScript setup. Set 'exports' field in the 'package.json' file at the project root and unset the 'generateExportsField' option.`
      );
    }
    if (options.additionalEntryPoints?.length) {
      throw new Error(
        `Setting 'additionalEntryPoints' is not supported with the current TypeScript setup. Set additional entry points in the 'package.json' file at the project root and unset the 'additionalEntryPoints' option.`
      );
    }
  }

  const outputPath = join(root, options.outputPath);

  options.skipTypeCheck ??= !isTsSolutionSetup;

  if (options.watch == null) {
    options.watch = false;
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
    isTsSolutionSetup: isTsSolutionSetup,
  } as NormalizedSwcExecutorOptions;
}

export async function* swcExecutor(
  _options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } =
    context.projectsConfigurations.projects[context.projectName];
  const options = normalizeOptions(_options, context.root, sourceRoot, root);

  let swcHelperDependency: DependentBuildableProjectNode;
  if (!options.isTsSolutionSetup) {
    const { tmpTsConfig, dependencies } = checkDependencies(
      context,
      options.tsConfig
    );

    if (tmpTsConfig) {
      options.tsConfig = tmpTsConfig;
    }

    swcHelperDependency = getHelperDependency(
      HelperDependency.swc,
      options.swcCliOptions.swcrcPath,
      dependencies,
      context.projectGraph
    );

    if (swcHelperDependency) {
      dependencies.push(swcHelperDependency);
    }
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
      let packageJsonResult: CopyPackageJsonResult;
      if (!options.isTsSolutionSetup) {
        packageJsonResult = await copyPackageJson(
          {
            ...options,
            additionalEntryPoints: createEntryPoints(options, context),
            format: [
              determineModuleFormatFromSwcrc(options.swcCliOptions.swcrcPath),
            ],
          },
          context
        );
      }
      removeTmpSwcrc(options.swcCliOptions.swcrcPath);
      disposeFn = () => {
        assetResult?.stop();
        packageJsonResult?.stop();
      };
    });
  } else {
    return yield compileSwc(context, options, async () => {
      await copyAssets(options, context);
      if (!options.isTsSolutionSetup) {
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
      }
      removeTmpSwcrc(options.swcCliOptions.swcrcPath);
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
    expandDirectories: false,
  });
}

export default swcExecutor;
