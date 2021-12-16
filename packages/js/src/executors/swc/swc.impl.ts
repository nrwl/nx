import { ExecutorContext } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  assetGlobsToFiles,
  copyAssetFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join, resolve } from 'path';
import { checkDependencies } from '../../utils/check-dependencies';
import { compileSwc } from '../../utils/swc/compile-swc';
import { printDiagnostics } from '../../utils/typescript/print-diagnostics';
import { runTypeCheck } from '../../utils/typescript/run-type-check';
import { updatePackageJson } from '../../utils/update-package-json';
import { NormalizedSwcExecutorOptions, SwcExecutorOptions } from './schema';

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

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    contextRoot,
    outputPath
  );

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
    outputPath,
    tsConfig: join(contextRoot, options.tsConfig),
  } as NormalizedSwcExecutorOptions;
}

export async function swcExecutor(
  options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const normalizedOptions = normalizeOptions(
    options,
    context.root,
    sourceRoot,
    root
  );
  const { shouldContinue, tmpTsConfig, projectRoot } = checkDependencies(
    context,
    options.tsConfig
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
    watch: normalizedOptions.watch,
  };

  const postCompilationCallback = async () => {
    await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
  };

  if (!options.skipTypeCheck) {
    const ts = await import('typescript');
    // start two promises, one for type checking, one for transpiling
    return Promise.all([
      runTypeCheck({
        ts,
        mode: 'emitDeclarationOnly',
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
      compileSwc(context, normalizedOptions, postCompilationCallback),
    ]).then(([typeCheckResult, transpileResult]) => ({
      success: typeCheckResult.success && transpileResult.success,
      outfile: normalizedOptions.mainOutputPath,
    }));
  }

  return compileSwc(context, normalizedOptions, postCompilationCallback).then(
    ({ success }) => ({ success, outfile: normalizedOptions.mainOutputPath })
  );
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
}

export default swcExecutor;
