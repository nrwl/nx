import * as fs from 'fs';
import type { Compiler, WebpackPluginInstance } from 'webpack';
import {
  createLockFile,
  createPackageJson,
  emitPrunedPnpmInstallAssets,
  getHelperDependenciesFromProjectGraph,
  getLockFileName,
  getWorkspacePackagesFromGraph,
  HelperDependency,
  readTsConfig,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
} from '@nx/js';
import {
  detectPackageManager,
  type ProjectGraph,
  readJsonFile,
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
        const depPkgJson = require.resolve(`${dep}/package.json`);
        if (!fs.existsSync(depPkgJson)) continue;
        const { name, version } = readJsonFile(depPkgJson);
        runtimeDependencies[name] = version;
      }
    }
    return runtimeDependencies;
  }

  apply(compiler: Compiler): void {
    const { sources } = require('webpack') as typeof import('webpack');

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
              // A pruned lockfile is always emitted alongside (except for bun,
              // which ignores pnpm config), so drop baked pnpm config here.
              prunedLockfile: true,
            }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          packageJson.dependencies = {
            ...packageJson.dependencies,
            ...runtimeDependencies,
          };

          const packageManager = detectPackageManager(this.options.root);

          if (packageManager === 'bun') {
            compilation
              .getLogger('GeneratePackageJsonPlugin')
              .warn(
                'Bun lockfile generation is not supported. Only package.json will be generated.'
              );
          } else {
            // pnpm re-resolves local-path manifest specifiers on a non-frozen
            // install, so make them deploy-root-relative before the lockfile
            // copies them.
            if (packageManager === 'pnpm') {
              rewritePrunedLocalPathSpecifiers(
                packageJson,
                this.options.projectGraph.nodes[this.options.projectName].data
                  .root,
                this.options.root,
                new Set(
                  getWorkspacePackagesFromGraph(
                    this.options.projectGraph
                  ).keys()
                )
              );
            }
            // `pruned` flips off when createLockFile falls back to the root
            // lockfile, whose importer describes the whole workspace: skip the
            // link: closure validation and local-path shipping for it.
            let pruned = true;
            const lockFileContent = createLockFile(
              packageJson,
              this.options.projectGraph,
              packageManager,
              {
                onPruneFallback: () => {
                  pruned = false;
                },
              }
            );
            if (packageManager === 'pnpm' && pruned) {
              validatePrunedLocalPathClosure(
                packageJson,
                this.options.root,
                lockFileContent
              );
            }
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
                this.options.root,
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
