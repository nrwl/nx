import {
  type Tree,
  type GeneratorCallback,
  joinPathFragments,
  addDependenciesToPackageJson,
  ensurePackage,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addRsbuild(tree: Tree, options: NormalizedSchema) {
  const tasks: GeneratorCallback[] = [];
  ensurePackage('@nx/rsbuild', nxVersion);
  // `require()` honors Module._initPaths (which ensurePackage updates); ESM
  // dynamic `import()` doesn't, so it can't see the on-demand temp install.
  const {
    initGenerator,
    configurationGenerator,
  }: typeof import('@nx/rsbuild/generators') = require('@nx/rsbuild/generators');
  const initTask = await initGenerator(tree, {
    skipPackageJson: options.skipPackageJson,
    addPlugin: true,
    skipFormat: true,
  });
  tasks.push(initTask);

  const rsbuildTask = await configurationGenerator(tree, {
    project: options.projectName,
    entry: `./src/main.ts`,
    tsConfig: './tsconfig.app.json',
    target: 'web',
    devServerPort: options.devServerPort ?? 4200,
  });
  tasks.push(rsbuildTask);

  const {
    addBuildPlugin,
    addHtmlTemplatePath,
    versions,
  }: typeof import('@nx/rsbuild/config-utils') = require('@nx/rsbuild/config-utils');

  const deps = { '@rsbuild/plugin-vue': versions.rsbuildPluginVueVersion };

  const pathToConfigFile = joinPathFragments(
    options.appProjectRoot,
    'rsbuild.config.ts'
  );
  addBuildPlugin(tree, pathToConfigFile, '@rsbuild/plugin-vue', 'pluginVue');

  if (options.style === 'scss') {
    addBuildPlugin(
      tree,
      pathToConfigFile,
      '@rsbuild/plugin-sass',
      'pluginSass'
    );
    deps['@rsbuild/plugin-sass'] = versions.rsbuildPluginSassVersion;
  }

  addHtmlTemplatePath(tree, pathToConfigFile, './index.html');
  tasks.push(addDependenciesToPackageJson(tree, {}, deps, undefined, true));

  return tasks;
}
