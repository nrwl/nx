import type { BuilderContext } from '@angular-devkit/architect';
import type {
  ApplicationBuilderOptions,
  BrowserBuilderOptions,
} from '@angular-devkit/build-angular';
import type { Schema as BrowserEsbuildBuilderOptions } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import type { Target } from '@nx/devkit';

const executorToBuilderMap = new Map<string, string>([
  [
    '@nx/angular:browser-esbuild',
    '@angular-devkit/build-angular:browser-esbuild',
  ],
  ['@nx/angular:application', '@angular-devkit/build-angular:application'],
]);

export function patchBuilderContext(
  context: BuilderContext,
  isUsingEsbuildBuilder: boolean,
  buildTarget: Target
): void {
  const originalGetBuilderNameForTarget = context.getBuilderNameForTarget;
  context.getBuilderNameForTarget = async (target) => {
    const builderName = await originalGetBuilderNameForTarget(target);

    if (executorToBuilderMap.has(builderName)) {
      return executorToBuilderMap.get(builderName)!;
    }

    return builderName;
  };

  if (isUsingEsbuildBuilder) {
    const originalGetTargetOptions = context.getTargetOptions;
    context.getTargetOptions = async (target) => {
      const options = await originalGetTargetOptions(target);

      if (
        target.project === buildTarget.project &&
        target.target === buildTarget.target &&
        target.configuration === buildTarget.configuration
      ) {
        cleanBuildTargetOptions(options);
      }

      return options;
    };
  }
}

function cleanBuildTargetOptions(
  options: any
):
  | ApplicationBuilderOptions
  | BrowserBuilderOptions
  | BrowserEsbuildBuilderOptions {
  delete options.buildLibsFromSource;
  delete options.customWebpackConfig;
  delete options.indexHtmlTransformer;
  delete options.indexFileTransformer;
  delete options.plugins;

  return options;
}
