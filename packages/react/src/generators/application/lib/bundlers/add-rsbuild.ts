import {
  type Tree,
  ensurePackage,
  joinPathFragments,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { nxVersion } from '../../../../utils/versions';
import { maybeJs } from '../../../../utils/maybe-js';
import { NormalizedSchema, Schema } from '../../schema';

export async function initRsbuild(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  ensurePackage('@nx/rsbuild', nxVersion);
  const { initGenerator } = await import('@nx/rsbuild/generators');
  const initTask = await initGenerator(tree, {
    skipPackageJson: options.skipPackageJson,
    addPlugin: true,
    skipFormat: true,
  });
  tasks.push(initTask);
}

export async function setupRsbuildConfiguration(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  ensurePackage('@nx/rsbuild', nxVersion);
  const { configurationGenerator } = await import('@nx/rsbuild/generators');
  const {
    addBuildPlugin,
    addCopyAssets,
    addHtmlTemplatePath,
    addSourceDefine,
    versions,
  } = await import('@nx/rsbuild/config-utils');
  const rsbuildTask = await configurationGenerator(tree, {
    project: options.projectName,
    entry: maybeJs(
      {
        js: options.js,
        useJsx: true,
      },
      `./src/main.tsx`
    ),
    tsConfig: './tsconfig.app.json',
    target: 'web',
    devServerPort: options.devServerPort ?? 4200,
  });
  tasks.push(rsbuildTask);

  const pathToConfigFile = joinPathFragments(
    options.appProjectRoot,
    'rsbuild.config.ts'
  );

  if (options.inSourceTests && options.unitTestRunner === 'vitest') {
    addSourceDefine(tree, pathToConfigFile, 'import.meta.vitest', 'undefined');
  }

  const deps = { '@rsbuild/plugin-react': versions.rsbuildPluginReactVersion };

  addBuildPlugin(
    tree,
    pathToConfigFile,
    '@rsbuild/plugin-react',
    'pluginReact'
  );

  if (options.style === 'scss') {
    addBuildPlugin(
      tree,
      pathToConfigFile,
      '@rsbuild/plugin-sass',
      'pluginSass'
    );
    deps['@rsbuild/plugin-sass'] = versions.rsbuildPluginSassVersion;
  }

  addHtmlTemplatePath(tree, pathToConfigFile, './src/index.html');
  addCopyAssets(tree, pathToConfigFile, './src/assets');
  addCopyAssets(tree, pathToConfigFile, './src/favicon.ico');
  tasks.push(addDependenciesToPackageJson(tree, {}, deps));
}
