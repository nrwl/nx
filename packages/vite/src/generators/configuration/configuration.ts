import {
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import {
  addBuildTarget,
  addServeTarget,
  addPreviewTarget,
  createOrEditViteConfig,
  TargetFlags,
} from '../../utils/generator-utils';

import initGenerator from '../init/init';
import vitestGenerator from '../vitest/vitest-generator';
import { ViteConfigurationGeneratorSchema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import { convertNonVite } from './lib/convert-non-vite';

export function viteConfigurationGenerator(
  host: Tree,
  schema: ViteConfigurationGeneratorSchema
) {
  return viteConfigurationGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function viteConfigurationGeneratorInternal(
  tree: Tree,
  schema: ViteConfigurationGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const projectConfig = readProjectConfiguration(tree, schema.project);
  const { targets, root: projectRoot } = projectConfig;

  const projectType = projectConfig.projectType ?? 'library';

  schema.includeLib ??= projectType === 'library';

  // Setting default to jsdom since it is the most common use case (React, Web).
  // The @nx/js:lib generator specifically sets this to node to be more generic.
  schema.testEnvironment ??= 'jsdom';

  /**
   * This is for when we are converting an existing project
   * to use the vite executors.
   */
  let projectAlreadyHasViteTargets: TargetFlags = {};

  if (!schema.newProject) {
    await convertNonVite(tree, schema, projectRoot, projectType, targets);
  }

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    skipFormat: true,
    tsConfigName: projectRoot === '.' ? 'tsconfig.json' : 'tsconfig.base.json',
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(tree, { ...schema, skipFormat: true });
  tasks.push(initTask);
  tasks.push(ensureDependencies(tree, schema));

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );

  if (!hasPlugin) {
    if (!projectAlreadyHasViteTargets.build) {
      addBuildTarget(tree, schema, 'build');
    }

    if (!schema.includeLib) {
      if (!projectAlreadyHasViteTargets.serve) {
        addServeTarget(tree, schema, 'serve');
      }
      if (!projectAlreadyHasViteTargets.preview) {
        addPreviewTarget(tree, schema, 'preview');
      }
    }
  }
  if (projectType === 'library') {
    // update tsconfig.lib.json to include vite/client
    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.lib.json'),
      (json) => {
        if (!json.compilerOptions) {
          json.compilerOptions = {};
        }
        if (!json.compilerOptions.types) {
          json.compilerOptions.types = [];
        }
        if (!json.compilerOptions.types.includes('vite/client')) {
          return {
            ...json,
            compilerOptions: {
              ...json.compilerOptions,
              types: [...json.compilerOptions.types, 'vite/client'],
            },
          };
        }
        return json;
      }
    );
  }

  if (!schema.newProject) {
    // We are converting existing project to use Vite
    if (schema.uiFramework === 'react') {
      createOrEditViteConfig(
        tree,
        {
          project: schema.project,
          includeLib: schema.includeLib,
          includeVitest: schema.includeVitest,
          inSourceTests: schema.inSourceTests,
          rollupOptionsExternal: [
            "'react'",
            "'react-dom'",
            "'react/jsx-runtime'",
          ],
          imports: [
            schema.compiler === 'swc'
              ? `import react from '@vitejs/plugin-react-swc'`
              : `import react from '@vitejs/plugin-react'`,
          ],
          plugins: ['react()'],
        },
        false,
        undefined
      );
    } else {
      createOrEditViteConfig(tree, schema, false, projectAlreadyHasViteTargets);
    }
  }

  if (schema.includeVitest) {
    const vitestTask = await vitestGenerator(tree, {
      project: schema.project,
      uiFramework: schema.uiFramework,
      inSourceTests: schema.inSourceTests,
      coverageProvider: 'v8',
      skipViteConfig: true,
      testTarget: 'test',
      skipFormat: true,
      addPlugin: schema.addPlugin,
      compiler: schema.compiler,
    });
    tasks.push(vitestTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default viteConfigurationGenerator;
