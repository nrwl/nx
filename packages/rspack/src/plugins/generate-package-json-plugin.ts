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
            const lockFileContent = createLockFile(
              packageJson,
              this.projectGraph,
              packageManager
            );
            compilation.emitAsset(
              getLockFileName(packageManager),
              new sources.RawSource(lockFileContent)
            );
            // pnpm 11 reads build-script approvals, supportedArchitectures, and
            // patchedDependencies only from pnpm-workspace.yaml, so emit them
            // beside the lockfile; pnpm <=10 takes patchedDependencies from the
            // package.json emitted below.
            if (packageManager === 'pnpm') {
              emitPrunedPnpmInstallAssets(
                this.context.root,
                lockFileContent,
                packageJson,
                (assetPath, content) =>
                  compilation.emitAsset(
                    assetPath,
                    new sources.RawSource(content)
                  )
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
