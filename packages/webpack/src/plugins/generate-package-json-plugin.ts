import { type Compiler, sources, type WebpackPluginInstance } from 'webpack';
import {
  createLockFile,
  createPackageJson,
  ExecutorContext,
  type ProjectGraph,
  serializeJson,
} from '@nrwl/devkit';
import {
  getHelperDependenciesFromProjectGraph,
  HelperDependency,
} from '@nrwl/js/src/utils/compiler-helper-dependency';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { getLockFileName } from 'nx/src/lock-file/lock-file';

const pluginName = 'GeneratePackageJsonPlugin';

export class GeneratePackageJsonPlugin implements WebpackPluginInstance {
  private readonly projectGraph: ProjectGraph;

  constructor(
    private readonly options: { tsConfig: string; outputFileName: string },
    private readonly context: ExecutorContext
  ) {
    this.projectGraph = context.projectGraph;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const helperDependencies = getHelperDependenciesFromProjectGraph(
            this.context.root,
            this.context.projectName,
            this.projectGraph
          );

          const importHelpers = !!readTsConfig(this.options.tsConfig).options
            .importHelpers;
          const shouldAddHelperDependency =
            importHelpers &&
            helperDependencies.every(
              (dep) => dep.target !== HelperDependency.tsc
            );

          if (shouldAddHelperDependency) {
            helperDependencies.push({
              type: 'static',
              source: this.context.projectName,
              target: HelperDependency.tsc,
            });
          }

          if (helperDependencies.length > 0) {
            this.projectGraph.dependencies[this.context.projectName] =
              this.projectGraph.dependencies[this.context.projectName].concat(
                helperDependencies
              );
          }

          const packageJson = createPackageJson(
            this.context.projectName,
            this.projectGraph,
            { root: this.context.root, isProduction: true }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
          compilation.emitAsset(
            getLockFileName(),
            new sources.RawSource(createLockFile(packageJson))
          );
        }
      );
    });
  }
}
