import { ExecutorContext } from '@nrwl/devkit';
import {
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { compileTypeScript } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { join } from 'path';
import { NormalizedBuilderOptions } from './models';

export default function compileTypeScriptFiles(
  options: NormalizedBuilderOptions,
  context: ExecutorContext,
  libRoot: string,
  projectDependencies: DependentBuildableProjectNode[]
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

  return compileTypeScript({
    outputPath: options.normalizedOutputPath,
    projectName: context.projectName,
    projectRoot: libRoot,
    tsConfig: tsConfigPath,
    deleteOutputPath: options.deleteOutputPath,
    rootDir: options.srcRootForCompilationRoot,
    watch: options.watch,
  });
}
