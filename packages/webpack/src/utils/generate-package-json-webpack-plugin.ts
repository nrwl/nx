import { type Compiler, sources, type WebpackPluginInstance } from 'webpack';
import {
  ExecutorContext,
  ProjectConfiguration,
  type ProjectGraph,
  serializeJson,
} from '@nrwl/devkit';
import { createPackageJson } from '@nrwl/workspace/src/utilities/create-package-json';
import {
  getHelperDependenciesFromProjectGraph,
  HelperDependency,
} from '@nrwl/js/src/utils/compiler-helper-dependency';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';

import { NormalizedWebpackExecutorOptions } from '../executors/webpack/schema';

export class GeneratePackageJsonWebpackPlugin implements WebpackPluginInstance {
  private readonly projectConfig: ProjectConfiguration;
  private readonly projectGraph: ProjectGraph;

  constructor(
    private readonly context: ExecutorContext,
    private readonly options: NormalizedWebpackExecutorOptions
  ) {
    this.projectConfig = context.workspace.projects[context.projectName];
    this.projectGraph = context.projectGraph;
  }

  apply(compiler: Compiler): void {
    const pluginName = this.constructor.name;

    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'nx-generate-package-json-plugin',
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
            { root: this.context.root, projectRoot: this.projectConfig.root }
          );
          packageJson.main = packageJson.main ?? this.options.outputFileName;

          delete packageJson.devDependencies;

          compilation.emitAsset(
            'package.json',
            new sources.RawSource(serializeJson(packageJson))
          );
        }
      );
    });
  }
}
