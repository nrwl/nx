import * as fs from 'fs';
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
      skipPackageManager?: boolean;
      tsConfig: string;
      outputFileName: string;
      root: string;
      projectName: string;
      targetName: string;
      projectGraph: ProjectGraph;
      runtimeDependencies?: string[];
    }
  ) {}


  private resolveRuntimeDependencies(): Record<string, string> {
    const runtimeDependencies: Record<string, string> = {};
    if (this.options.runtimeDependencies) {
      for (const dep of this.options.runtimeDependencies) {
        const pkgs = fs.readFileSync(`${process.env.NX_WORKSPACE_ROOT}/node_modules/${dep}/package.json`, 'utf-8');
        const { name, version } = JSON.parse(pkgs);
        runtimeDependencies[name] = version;
      }
    }
    return runtimeDependencies;
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
          const runtimeDependencies = this.resolveRuntimeDependencies()

          const packageJson = createPackageJson(
            this.options.projectName,
            this.options.projectGraph,
            {
              target: this.options.targetName,
              root: this.options.root,
              isProduction: true,
              helperDependencies: helperDependencies.map((dep) => dep.target),
              skipPackageManager: this.options.skipPackageManager,
            }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          packageJson.dependencies = {
            ...packageJson.dependencies,
            ...runtimeDependencies
          };

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
          const packageManager = detectPackageManager(this.options.root);

          if (packageManager === 'bun') {
            compilation
              .getLogger('GeneratePackageJsonPlugin')
              .warn(
                'Bun lockfile generation is not supported. Only package.json will be generated.'
              );
          } else {
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
        }
      );
    });
  }
}
