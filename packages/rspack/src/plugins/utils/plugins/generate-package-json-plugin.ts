import * as fs from 'fs';
import type { Compiler, RspackPluginInstance } from '@rspack/core';
import {
  createPackageJson,
  generatePrunedDeployOutput,
  getHelperDependenciesFromProjectGraph,
  HelperDependency,
  readTsConfig,
} from '@nx/js';
import {
  detectPackageManager,
  type ProjectGraph,
  readJsonFile,
  serializeJson,
} from '@nx/devkit';

const pluginName = 'GeneratePackageJsonPlugin';

export class GeneratePackageJsonPlugin implements RspackPluginInstance {
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
        const depPkgJson = require.resolve(`${dep}/package.json`);
        if (!fs.existsSync(depPkgJson)) continue;
        const { name, version } = readJsonFile(depPkgJson);
        runtimeDependencies[name] = version;
      }
    }
    return runtimeDependencies;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async () => {
          const sources = compiler.rspack.sources;
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

          const runtimeDependencies = this.resolveRuntimeDependencies();

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
            ...runtimeDependencies,
          };

          const packageManager = detectPackageManager(this.options.root);

          generatePrunedDeployOutput(
            packageJson,
            this.options.projectGraph,
            this.options.projectGraph.nodes[this.options.projectName].data.root,
            {
              emit: (assetPath, content) =>
                compilation.emitAsset(
                  assetPath,
                  new sources.RawSource(content)
                ),
              packageManager,
              workspaceRoot: this.options.root,
            }
          );

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
        }
      );
    });
  }
}
