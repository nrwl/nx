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
  const { initGenerator, configurationGenerator } = await import(
    '@nx/rsbuild/generators'
  );
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

  const { addBuildPlugin, addHtmlTemplatePath, versions } = await import(
    '@nx/rsbuild/config-utils'
  );

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
  } else if (options.style === 'less') {
    addBuildPlugin(
      tree,
      pathToConfigFile,
      '@rsbuild/plugin-less',
      'pluginLess'
    );
    deps['@rsbuild/plugin-less'] = versions.rsbuildPluginLessVersion;
  }

  addHtmlTemplatePath(tree, pathToConfigFile, './index.html');
  tasks.push(addDependenciesToPackageJson(tree, {}, deps));

  return tasks;
}
