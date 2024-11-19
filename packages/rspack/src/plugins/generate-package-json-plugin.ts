import {
  ExecutorContext,
  detectPackageManager,
  serializeJson,
  type ProjectGraph,
} from '@nx/devkit';
import {
  HelperDependency,
  createLockFile,
  createPackageJson,
  getHelperDependenciesFromProjectGraph,
  getLockFileName,
  readTsConfig,
} from '@nx/js';
import {
  type Compiler,
  type RspackPluginInstance,
  sources,
} from '@rspack/core';

const pluginName = 'GeneratePackageJsonPlugin';

export class GeneratePackageJsonPlugin implements RspackPluginInstance {
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

          const packageJson = createPackageJson(
            this.context.projectName,
            this.projectGraph,
            {
              target: this.context.targetName,
              root: this.context.root,
              isProduction: true,
              helperDependencies: helperDependencies.map((dep) => dep.target),
            }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
          const packageManager = detectPackageManager(this.context.root);
          compilation.emitAsset(
            getLockFileName(packageManager),
            new sources.RawSource(
              createLockFile(packageJson, this.projectGraph, packageManager)
            )
          );
        }
      );
    });
  }
}
