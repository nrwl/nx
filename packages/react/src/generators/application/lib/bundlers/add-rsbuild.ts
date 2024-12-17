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
  const { initGenerator } = ensurePackage('@nx/rsbuild', nxVersion);
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
  const {
    configurationGenerator,
    addBuildPlugin,
    addCopyAssets,
    addHtmlTemplatePath,
    addExperimentalSwcPlugin,
    versions,
  } = ensurePackage('@nx/rsbuild', nxVersion);
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
  });
  tasks.push(rsbuildTask);

  const pathToConfigFile = joinPathFragments(
    options.appProjectRoot,
    'rsbuild.config.ts'
  );

  const deps = { '@rsbuild/plugin-react': versions.rsbuildPluginReactVersion };

  addBuildPlugin(
    tree,
    pathToConfigFile,
    '@rsbuild/plugin-react',
    'pluginReact',
    options.style === '@emotion/styled'
      ? `{
        swcReactOptions: {
          importSource: '@emotion/react',
        }
      }`
      : undefined
  );

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
  } else if (options.style === '@emotion/styled') {
    deps['@swc/plugin-emotion'] = versions.rsbuildSwcPluginEmotionVersion;
    addExperimentalSwcPlugin(tree, pathToConfigFile, '@swc/plugin-emotion');
  } else if (options.style === 'styled-jsx') {
    deps['@swc/plugin-styled-jsx'] = versions.rsbuildSwcPluginStyledJsxVersion;
    addExperimentalSwcPlugin(tree, pathToConfigFile, '@swc/plugin-styled-jsx');
  } else if (options.style === 'styled-components') {
    deps['@rsbuild/plugin-styled-components'] =
      versions.rsbuildPluginStyledComponentsVersion;
    addBuildPlugin(
      tree,
      pathToConfigFile,
      '@rsbuild/plugin-styled-components',
      'pluginStyledComponents'
    );
  }

  addHtmlTemplatePath(tree, pathToConfigFile, './src/index.html');
  addCopyAssets(tree, pathToConfigFile, './src/assets');
  addCopyAssets(tree, pathToConfigFile, './src/favicon.ico');
  tasks.push(addDependenciesToPackageJson(tree, {}, deps));
}
