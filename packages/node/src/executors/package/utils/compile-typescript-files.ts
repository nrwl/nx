import { ExecutorContext } from '@nrwl/devkit';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import {
  compileTypeScript,
  compileTypeScriptWatcher,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { join } from 'path';
import { NormalizedBuilderOptions } from './models';

export default async function compileTypeScriptFiles(
  options: NormalizedBuilderOptions,
  context: ExecutorContext,
  libRoot: string,
  projectDependencies: DependentBuildableProjectNode[],
  postCompleteAction: () => void | Promise<void>
) {
  let tsConfigPath = join(context.root, options.tsConfig);
  if (projectDependencies.length > 0) {
    tsConfigPath = createTmpTsConfig(
      tsConfigPath,
      context.root,
      libRoot,
      projectDependencies
    );
  }

  const tcsOptions = {
    outputPath: options.normalizedOutputPath,
    projectName: context.projectName,
    projectRoot: libRoot,
    tsConfig: tsConfigPath,
    deleteOutputPath: options.deleteOutputPath,
    rootDir: options.srcRootForCompilationRoot,
    watch: options.watch,
  };

  if (options.watch) {
    return compileTypeScriptWatcher(tcsOptions, async (d) => {
      // Means tsc found 0 errors, in watch mode. https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json
      if (d.code === 6194) {
        await postCompleteAction();
      }
    });
  } else {
    const result = compileTypeScript(tcsOptions);
    await postCompleteAction();
    return result;
  }
}
