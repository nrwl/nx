import {
  ExecutorContext,
  detectPackageManager,
  serializeJson,
  type ProjectGraph,
} from '@nx/devkit';
import {
  HelperDependency,
  createPackageJson,
  createPrunedLockfile,
  emitPrunedPnpmInstallAssets,
  getHelperDependenciesFromProjectGraph,
  getLockFileName,
  readTsConfig,
} from '@nx/js';
import type { Compiler, RspackPluginInstance } from '@rspack/core';

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
      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async () => {
          const sources = compiler.webpack.sources;
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
              // A pruned lockfile is always emitted alongside (except for bun,
              // which ignores pnpm config), so drop baked pnpm config here.
              prunedLockfile: true,
            }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          const packageManager = detectPackageManager(this.context.root);

          if (packageManager === 'bun') {
            compilation
              .getLogger('GeneratePackageJsonPlugin')
              .warn(
                'Bun lockfile generation is not supported. Only package.json will be generated.'
              );
          } else {
            const { lockFileContent, pruned } = createPrunedLockfile(
              packageJson,
              this.projectGraph,
              this.projectGraph.nodes[this.context.projectName].data.root,
              this.context.root,
              packageManager
            );
            compilation.emitAsset(
              getLockFileName(packageManager),
              new sources.RawSource(lockFileContent)
            );
            if (packageManager === 'pnpm') {
              emitPrunedPnpmInstallAssets(
                this.context.root,
                lockFileContent,
                packageJson,
                (assetPath, content) =>
                  compilation.emitAsset(
                    assetPath,
                    new sources.RawSource(content)
                  ),
                { includeLocalPathArtifacts: pruned }
              );
            }
          }

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
        }
      );
    });
  }
}
