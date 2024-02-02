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
  addOrChangeBuildTarget,
  addOrChangeServeTarget,
  addPreviewTarget,
  createOrEditViteConfig,
  deleteWebpackConfig,
  editTsConfig,
  findExistingTargetsInProject,
  handleUnknownExecutors,
  handleUnsupportedUserProvidedTargets,
  moveAndEditIndexHtml,
  TargetFlags,
  UserProvidedTargetName,
} from '../../utils/generator-utils';

import initGenerator from '../init/init';
import vitestGenerator from '../vitest/vitest-generator';
import { ViteConfigurationGeneratorSchema } from './schema';
import { ensureDependencies } from '../../utils/ensure-dependencies';

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

  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const projectConfig = readProjectConfiguration(tree, schema.project);
  const {
    targets,

    root: projectRoot,
  } = projectConfig;

  const projectType = projectConfig.projectType ?? 'library';
  let buildTargetName = 'build';
  let serveTargetName = 'serve';
  let testTargetName = 'test';

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
    const userProvidedTargetName: UserProvidedTargetName = {
      build: schema.buildTarget,
      serve: schema.serveTarget,
      test: schema.testTarget,
    };

    const {
      validFoundTargetName,
      projectContainsUnsupportedExecutor,
      userProvidedTargetIsUnsupported,
      alreadyHasNxViteTargets,
    } = findExistingTargetsInProject(targets, userProvidedTargetName);
    projectAlreadyHasViteTargets = alreadyHasNxViteTargets;
    /**
     * This means that we only found unsupported build targets in that project.
     * The only way that buildTarget is defined, means that it is supported.
     *
     * If the `unsupported` flag was false, it would mean that we did not find
     * a build target at all, so we can create a new one.
     *
     * So we only throw if we found a target, but it is unsupported.
     */
    if (!validFoundTargetName.build && projectContainsUnsupportedExecutor) {
      throw new Error(
        `The project ${schema.project} cannot be converted to use the @nx/vite executors.`
      );
    }

    if (
      alreadyHasNxViteTargets.build &&
      (alreadyHasNxViteTargets.serve || projectType === 'library') &&
      alreadyHasNxViteTargets.test
    ) {
      throw new Error(
        `The project ${schema.project} is already configured to use the @nx/vite executors.
        Please try a different project, or remove the existing targets 
        and re-run this generator to reset the existing Vite Configuration.
        `
      );
    }

    /**
     * This means that we did not find any supported executors
     * so we don't have any valid target names.
     *
     * However, the executors that we may have found are not in the
     * list of the specifically unsupported executors either.
     *
     * So, we should warn the user about it.
     */

    if (
      !projectContainsUnsupportedExecutor &&
      !validFoundTargetName.build &&
      !validFoundTargetName.serve &&
      !validFoundTargetName.test
    ) {
      await handleUnknownExecutors(schema.project);
    }

    /**
     * There is a possibility at this stage that the user has provided
     * targets with unsupported executors.
     * We keep track here of which of the targets that the user provided
     * are unsupported.
     * We do this with the `userProvidedTargetIsUnsupported` object,
     * which contains flags for each target (whether it is supported or not).
     *
     * We also keep track of the targets that we found in the project,
     * through the findExistingTargetsInProject function, which returns
     * targets for build/serve/test that use supported executors, and
     * can be converted to use the vite executors. These are the
     * kept in the validFoundTargetName object.
     */
    await handleUnsupportedUserProvidedTargets(
      userProvidedTargetIsUnsupported,
      userProvidedTargetName,
      validFoundTargetName
    );

    /**
     * Once the user is at this stage, then they can go ahead and convert.
     */

    buildTargetName = validFoundTargetName.build ?? buildTargetName;
    serveTargetName = validFoundTargetName.serve ?? serveTargetName;

    if (projectType === 'application') {
      moveAndEditIndexHtml(tree, schema, buildTargetName);
    }

    deleteWebpackConfig(
      tree,
      projectRoot,
      targets?.[buildTargetName]?.options?.webpackConfig
    );

    editTsConfig(tree, schema);
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
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );

  if (!hasPlugin) {
    if (!projectAlreadyHasViteTargets.build) {
      addOrChangeBuildTarget(tree, schema, buildTargetName);
    }

    if (!schema.includeLib) {
      if (!projectAlreadyHasViteTargets.serve) {
        addOrChangeServeTarget(tree, schema, serveTargetName);
      }
      if (!projectAlreadyHasViteTargets.preview) {
        addPreviewTarget(tree, schema, serveTargetName);
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
      testTarget: testTargetName,
      skipFormat: true,
      addPlugin: schema.addPlugin,
    });
    tasks.push(vitestTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default viteConfigurationGenerator;
