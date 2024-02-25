import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { hasExpoPlugin } from '../../../utils/has-expo-plugin';
import { NormalizedSchema } from './normalize-options';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const hasPlugin = hasExpoPlugin(tree);
  const port = hasPlugin ? 8081 : 4200;
  switch (options.e2eTestRunner) {
    case 'cypress': {
      const hasNxExportPlugin = hasExpoPlugin(tree);
      if (!hasNxExportPlugin) {
        webStaticServeGenerator(tree, {
          buildTarget: `${options.projectName}:export`,
          targetName: 'serve-static',
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
        implicitDependencies: [options.projectName],
        tags: [],
      });

      return await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        // the name and root are already normalized, instruct the generator to use them as is
        bundler: 'none',
        skipFormat: true,
        devServerTarget: `${options.projectName}:serve`,
        port,
        baseUrl: `http://localhost:${port}`,
        ciWebServerCommand: hasNxExportPlugin
          ? `nx run ${options.projectName}:serve-static`
          : undefined,
        jsx: true,
        rootProject: options.rootProject,
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
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: `${getPackageManagerCommand().exec} nx serve ${
          options.name
        }`,
        webServerAddress: `http://localhost:${port}`,
        rootProject: options.rootProject,
      });
    }
    case 'detox':
      const { detoxApplicationGenerator } = ensurePackage<
        typeof import('@nx/detox')
      >('@nx/detox', nxVersion);
      return detoxApplicationGenerator(tree, {
        ...options,
        e2eName: options.e2eProjectName,
        e2eDirectory: options.e2eProjectRoot,
        projectNameAndRootFormat: 'as-provided',
        appProject: options.projectName,
        appDisplayName: options.displayName,
        appName: options.name,
        framework: 'expo',
        setParserOptionsProject: options.setParserOptionsProject,
        skipFormat: true,
      });
    case 'none':
    default:
      return () => {};
  }
}
