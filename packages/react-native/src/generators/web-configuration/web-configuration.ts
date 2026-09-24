import {
  addDependenciesToPackageJson,
  updateProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { hasWebpackPlugin } from '@nx/react/internal';

import {
  nxVersion,
  reactNativeWebVersion,
  reactNativeSvgWebVersion,
  typesReactDomVersion,
  assertSupportedReactNativeVersion,
} from '../../utils/versions';
import { NormalizedSchema, normalizeSchema } from './lib/normalize-schema';
import { createNxWebpackPluginOptions } from './lib/webpack-targets';

import { WebConfigurationGeneratorSchema } from './schema';

/**
 * This function sets web configuration for react native apps with react-native-web.
 * 1. install react-native-web
 * 2. apply webpack or vite init generator
 * 3. create files for webpack or vite config, index.html, assets folder, babel.config.js
 * @param tree
 * @param options
 */
export async function webConfigurationGenerator(
  tree: Tree,
  options: WebConfigurationGeneratorSchema
) {
  assertSupportedReactNativeVersion(tree);

  const normalizedSchema = normalizeSchema(tree, options);

  const tasks: GeneratorCallback[] = [];

  // install react-native-web
  if (!options.skipPackageJson) {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        'react-native-web': reactNativeWebVersion,
        'react-native-svg-web': reactNativeSvgWebVersion,
      },
      undefined,
      true
    );
    tasks.push(installTask);
  }

  // apply webpack or vite init generator
  const bundlerTasks = await addBundlerConfiguration(tree, normalizedSchema);
  tasks.push(...bundlerTasks);

  // create files for webpack and vite config, index.html
  if (normalizedSchema.bundler === 'vite') {
    generateFiles(
      tree,
      joinPathFragments(__dirname, './files/base-vite'),
      normalizedSchema.projectRoot,
      { ...normalizedSchema, tmpl: '' }
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, './files/base-webpack'),
      normalizedSchema.projectRoot,
      {
        ...normalizedSchema,
        tmpl: '',
        webpackPluginOptions: hasWebpackPlugin(tree)
          ? createNxWebpackPluginOptions(tree, normalizedSchema)
          : null,
      }
    );
  }

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@types/react-dom': typesReactDomVersion,
        },
        undefined,
        true
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

/**
 * Add bundler configuration
 * - for vite, viteConfigurationGenerator contains logics to add build and serve target
 * - for webpack, need to explict add the build and serve target
 */
async function addBundlerConfiguration(
  tree: Tree,
  normalizedSchema: NormalizedSchema
): Promise<GeneratorCallback[]> {
  if (normalizedSchema.bundler === 'vite') {
    const { viteConfigurationGenerator } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
    const viteTask = await viteConfigurationGenerator(tree, {
      ...normalizedSchema,
      uiFramework: 'react',
      project: normalizedSchema.project,
      newProject: true,
      includeVitest: false,
      projectType: 'application',
      compiler: 'babel',
      skipFormat: true,
    });
    return [viteTask];
  } else {
    let tasks: GeneratorCallback[] = [];
    const { webpackInitGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    const webpackInitTask = await webpackInitGenerator(tree, {
      ...normalizedSchema,
      skipFormat: true,
      skipPackageJson: normalizedSchema.skipPackageJson,
    });
    tasks.push(webpackInitTask);
    if (!normalizedSchema.skipPackageJson) {
      const {
        ensureDependencies,
      }: typeof import('@nx/webpack/internal') = require('@nx/webpack/internal');
      tasks.push(ensureDependencies(tree, { uiFramework: 'react' }));
    }

    return tasks;
  }
}

export default webConfigurationGenerator;
