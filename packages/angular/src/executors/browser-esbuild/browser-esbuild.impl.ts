import { type EsBuildSchema } from './schema';
import { type DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { type ExecutorContext, readCachedProjectGraph } from '@nx/devkit';
import { createTmpTsConfigForBuildableLibs } from './lib/buildable-libs';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { type BuilderOutput } from '@angular-devkit/architect';
import { type OutputFile } from 'esbuild';

export default async function* esbuildExecutor(
  options: EsBuildSchema,
  context: ExecutorContext
) {
  options.buildLibsFromSource ??= true;

  const { buildLibsFromSource, ...delegateExecutorOptions } = options;

  let dependencies: DependentBuildableProjectNode[];
  let projectGraph = context.projectGraph;

  if (!buildLibsFromSource) {
    projectGraph = projectGraph ?? readCachedProjectGraph();
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(
        delegateExecutorOptions.tsConfig,
        context,
        { projectGraph }
      );
    dependencies = foundDependencies;
    delegateExecutorOptions.tsConfig = tsConfigPath;
  }
  const { buildEsbuildBrowser } = await import(
    '@angular-devkit/build-angular/src/builders/browser-esbuild/index'
  );

  const builderContext = await createBuilderContext(
    {
      builderName: 'browser-esbuild',
      description: 'Build a browser application',
      optionSchema: await import(
        '@angular-devkit/build-angular/src/builders/browser-esbuild/schema.json'
      ),
    },
    context
  );

  return yield* buildEsbuildBrowser(
    delegateExecutorOptions,
    builderContext
  ) as AsyncIterable<
    BuilderOutput & {
      outputFiles?: OutputFile[];
      assetFiles?: { source: string; destination: string }[];
    }
  >;
}
