import { ExecutorContext } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  assetGlobsToFiles,
  copyAssetFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join } from 'path';
import { merge } from 'rxjs';
import { last, scan } from 'rxjs/operators';
import { checkDependencies } from '../../utils/check-dependencies';
import { compileSwc } from '../../utils/swc/compile-swc';
import { printDiagnostics } from '../../utils/typescript/print-diagnostics';
import { runTypeCheck } from '../../utils/typescript/run-type-check';
import { updatePackageJson } from '../../utils/update-package-json';
import { NormalizedSwcExecutorOptions, SwcExecutorOptions } from './schema';

export function normalizeOptions(
  options: SwcExecutorOptions,
  context: ExecutorContext
): NormalizedSwcExecutorOptions {
  const outputPath = join(context.root, options.outputPath);

  if (options.skipTypeCheck == null) {
    options.skipTypeCheck = false;
  }

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    context.root,
    outputPath
  );

  return {
    ...options,
    files,
    outputPath,
    tsConfig: join(context.root, options.tsConfig),
  } as NormalizedSwcExecutorOptions;
}

export async function swcExecutor(
  options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const normalizedOptions = normalizeOptions(options, context);
  const { shouldContinue, tmpTsConfig, projectRoot } = checkDependencies(
    context,
    normalizedOptions.tsConfig
  );

  if (!shouldContinue) {
    return { success: false };
  }

  if (tmpTsConfig) {
    normalizedOptions.tsConfig = tmpTsConfig;
  }

  const tsOptions = {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot,
    tsConfig: normalizedOptions.tsConfig,
  };

  if (!options.skipTypeCheck) {
    const ts = await import('typescript');
    // start two promises, one for type checking, one for transpiling
    return merge(
      runTypeCheck({
        ts,
        mode: 'emitDeclarationOnly',
        projectRoot: tsOptions.projectRoot,
        tsConfigPath: tsOptions.tsConfig,
        outDir: tsOptions.outputPath.replace(`/${projectRoot}`, ''),
        workspaceRoot: appRootPath,
      }).then((result) => {
        const hasErrors = result.errors.length > 0;

        if (hasErrors) {
          printDiagnostics(result);
        }

        return Promise.resolve({ success: !hasErrors });
      }),
      compileSwc(tsOptions, async () => {
        await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
      })
    )
      .pipe(
        scan(
          (acc, { success }) => {
            acc.success = success;
            return acc;
          },
          { success: false }
        ),
        last()
      )
      .toPromise();
  }

  return compileSwc(tsOptions, async () => {
    await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
  });
}

async function updatePackageAndCopyAssets(
  options: NormalizedSwcExecutorOptions,
  projectRoot: string
) {
  await copyAssetFiles(options.files);
  updatePackageJson(
    options.main,
    options.outputPath,
    projectRoot,
    !options.skipTypeCheck
  );
  // if (
  //   dependencies.length > 0 &&
  //   options.updateBuildableProjectDepsInPackageJson
  // ) {
  //   updateBuildableProjectPackageJsonDependencies(
  //     context.root,
  //     context.projectName,
  //     context.
  //     targetName,
  //     context.configurationName,
  //     target,
  //     dependencies,
  //     options.buildableProjectDepsInPackageJsonType
  //   );
  // }
}

export default swcExecutor;
