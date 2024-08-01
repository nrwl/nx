import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.find((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );
  const e2eWebServerTarget = hasPlugin
    ? typeof hasPlugin === 'string'
      ? 'serve'
      : (hasPlugin.options as any)?.serveTargetName ?? 'serve'
    : 'serve';
  const e2eCiWebServerTarget = hasPlugin
    ? typeof hasPlugin === 'string'
      ? 'preview'
      : (hasPlugin.options as any)?.previewTargetName ?? 'preview'
    : 'preview';
  switch (options.e2eTestRunner) {
    case 'cypress': {
      if (!hasPlugin) {
        await webStaticServeGenerator(tree, {
          buildTarget: `${options.projectName}:build`,
          targetName: 'serve-static',
          spa: true,
        });
      }

      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/cypress')
      >('@nx/cypress', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
      return await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        bundler: 'vite',
        skipFormat: true,
        devServerTarget: `${options.projectName}:${e2eWebServerTarget}`,
        baseUrl: 'http://localhost:4200',
        jsx: true,
        webServerCommands: hasPlugin
          ? {
              default: `nx run ${options.projectName}:${e2eWebServerTarget}`,
              production: `nx run ${options.projectName}:preview`,
            }
          : undefined,
        ciWebServerCommand: `nx run ${options.projectName}:${e2eCiWebServerTarget}`,
        ciBaseUrl: 'http://localhost:4300',
      });
    }
    case 'playwright': {
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/playwright')
      >('@nx/playwright', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.projectName],
      });
      return configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: `${getPackageManagerCommand().exec} nx run ${
          options.projectName
        }:${e2eCiWebServerTarget}`,
        webServerAddress: 'http://localhost:4300',
      });
    }
    case 'none':
    default:
      return () => {};
  }
}
