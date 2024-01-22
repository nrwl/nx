import { type Compiler, sources, type WebpackPluginInstance } from 'webpack';
import {
  createLockFile,
  createPackageJson,
  getHelperDependenciesFromProjectGraph,
  getLockFileName,
  HelperDependency,
  readTsConfig,
} from '@nx/js';
import {
  detectPackageManager,
  type ProjectGraph,
  serializeJson,
} from '@nx/devkit';

const pluginName = 'GeneratePackageJsonPlugin';

export class GeneratePackageJsonPlugin implements WebpackPluginInstance {
  constructor(
    private readonly options: {
      tsConfig: string;
      outputFileName: string;
      root: string;
      projectName: string;
      targetName: string;
      projectGraph: ProjectGraph;
    }
  ) {}

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const helperDependencies = getHelperDependenciesFromProjectGraph(
            this.options.root,
            this.options.projectName,
            this.options.projectGraph
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
              source: this.options.projectName,
              target: HelperDependency.tsc,
            });
          }

          const packageJson = createPackageJson(
            this.options.projectName,
            this.options.projectGraph,
            {
              target: this.options.targetName,
              root: this.options.root,
              isProduction: true,
              helperDependencies: helperDependencies.map((dep) => dep.target),
            }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
          const packageManager = detectPackageManager(this.options.root);
          compilation.emitAsset(
            getLockFileName(packageManager),
            new sources.RawSource(
              createLockFile(
                packageJson,
                this.options.projectGraph,
                packageManager
              )
            )
          );
        }
      );
    });
  }
}
