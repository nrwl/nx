import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  offsetFromRoot,
  ProjectType,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import {
  addOrChangeTestTarget,
  createOrEditViteConfig,
} from '../../utils/generator-utils';
import {
  vitestCoverageIstanbulVersion,
  vitestCoverageV8Version,
} from '../../utils/versions';
import initGenerator from '../init/init';
import { VitestGeneratorSchema } from './schema';
import { detectUiFramework } from '../../utils/detect-ui-framework';

/**
 * @param hasPlugin some frameworks (e.g. Nuxt) provide their own plugin. Their generators handle the plugin detection.
 */
export function vitestGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false
) {
  return vitestGeneratorInternal(
    tree,
    { addPlugin: false, ...schema },
    hasPlugin
  );
}

export async function vitestGeneratorInternal(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false
) {
  // Setting default to jsdom since it is the most common use case (React, Web).
  // The @nx/js:lib generator specifically sets this to node to be more generic.
  schema.testEnvironment ??= 'jsdom';

  const tasks: GeneratorCallback[] = [];

  const { root, projectType: _projectType } = readProjectConfiguration(
    tree,
    schema.project
  );
  const projectType = schema.projectType ?? _projectType;
  const uiFramework =
    schema.uiFramework ?? (await detectUiFramework(schema.project));
  const isRootProject = root === '.';

  tasks.push(await jsInitGenerator(tree, { ...schema, skipFormat: true }));
  const initTask = await initGenerator(tree, {
    skipFormat: true,
    addPlugin: schema.addPlugin,
  });
  tasks.push(initTask);
  tasks.push(ensureDependencies(tree, { ...schema, uiFramework }));

  addOrChangeTestTarget(tree, schema, hasPlugin);

  if (!schema.skipViteConfig) {
    if (uiFramework === 'angular') {
      const relativeTestSetupPath = joinPathFragments('src', 'test-setup.ts');

      const setupFile = joinPathFragments(root, relativeTestSetupPath);
      if (!tree.exists(setupFile)) {
        tree.write(
          setupFile,
          `import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
`
        );
      }

      createOrEditViteConfig(
        tree,
        {
          project: schema.project,
          includeLib: false,
          includeVitest: true,
          inSourceTests: false,
          imports: [`import angular from '@analogjs/vite-plugin-angular'`],
          plugins: ['angular()'],
          setupFile: relativeTestSetupPath,
          useEsmExtension: true,
        },
        true
      );
    } else if (uiFramework === 'react') {
      createOrEditViteConfig(
        tree,
        {
          project: schema.project,
          includeLib: projectType === 'library',
          includeVitest: true,
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
          coverageProvider: schema.coverageProvider,
        },
        true
      );
    } else {
      createOrEditViteConfig(
        tree,
        {
          ...schema,
          includeVitest: true,
          includeLib: projectType === 'library',
        },
        true
      );
    }
  }

  createFiles(tree, schema, root);
  updateTsConfig(tree, schema, root, projectType);

  const coverageProviderDependency = getCoverageProviderDependency(
    schema.coverageProvider
  );

  const installCoverageProviderTask = addDependenciesToPackageJson(
    tree,
    {},
    coverageProviderDependency
  );
  tasks.push(installCoverageProviderTask);

  // Setup workspace config file (https://vitest.dev/guide/workspace.html)
  if (
    !isRootProject &&
    !tree.exists(`vitest.workspace.ts`) &&
    !tree.exists(`vitest.workspace.js`) &&
    !tree.exists(`vitest.workspace.json`) &&
    !tree.exists(`vitest.projects.ts`) &&
    !tree.exists(`vitest.projects.js`) &&
    !tree.exists(`vitest.projects.json`)
  ) {
    tree.write(
      'vitest.workspace.ts',
      `export default ['**/*/vite.config.{ts,mts}', '**/*/vitest.config.{ts,mts}'];`
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function updateTsConfig(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string,
  projectType: ProjectType
) {
  const setupFile = tryFindSetupFile(tree, projectRoot);

  if (tree.exists(joinPathFragments(projectRoot, 'tsconfig.spec.json'))) {
    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.spec.json'),
      (json) => {
        if (!json.compilerOptions?.types?.includes('vitest')) {
          if (json.compilerOptions?.types) {
            json.compilerOptions.types.push('vitest');
          } else {
            json.compilerOptions ??= {};
            json.compilerOptions.types = ['vitest'];
          }
        }

        if (setupFile) {
          json.files = [...(json.files ?? []), setupFile];
        }

        return json;
      }
    );

    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.json'),
      (json) => {
        if (
          json.references &&
          !json.references.some((r) => r.path === './tsconfig.spec.json')
        ) {
          json.references.push({
            path: './tsconfig.spec.json',
          });
        }
        return json;
      }
    );
  } else {
    updateJson(
      tree,
      joinPathFragments(projectRoot, 'tsconfig.json'),
      (json) => {
        if (!json.compilerOptions?.types?.includes('vitest')) {
          if (json.compilerOptions?.types) {
            json.compilerOptions.types.push('vitest');
          } else {
            json.compilerOptions ??= {};
            json.compilerOptions.types = ['vitest'];
          }
        }
        return json;
      }
    );
  }

  let runtimeTsconfigPath = joinPathFragments(
    projectRoot,
    projectType === 'application' ? 'tsconfig.app.json' : 'tsconfig.lib.json'
  );
  if (options.runtimeTsconfigFileName) {
    runtimeTsconfigPath = joinPathFragments(
      projectRoot,
      options.runtimeTsconfigFileName
    );
    if (!tree.exists(runtimeTsconfigPath)) {
      throw new Error(
        `Cannot find the specified runtimeTsConfigFileName ("${options.runtimeTsconfigFileName}") at the project root "${projectRoot}".`
      );
    }
  }

  if (tree.exists(runtimeTsconfigPath)) {
    updateJson(tree, runtimeTsconfigPath, (json) => {
      if (options.inSourceTests) {
        (json.compilerOptions.types ??= []).push('vitest/importMeta');
      } else {
        const uniqueExclude = new Set([
          ...(json.exclude || []),
          'vite.config.ts',
          'vite.config.mts',
          'vitest.config.ts',
          'vitest.config.mts',
          'src/**/*.test.ts',
          'src/**/*.spec.ts',
          'src/**/*.test.tsx',
          'src/**/*.spec.tsx',
          'src/**/*.test.js',
          'src/**/*.spec.js',
          'src/**/*.test.jsx',
          'src/**/*.spec.jsx',
        ]);
        json.exclude = [...uniqueExclude];
      }

      if (setupFile) {
        json.exclude = [...(json.exclude ?? []), setupFile];
      }

      return json;
    });
  } else {
    logger.warn(
      `Couldn't find a runtime tsconfig file at ${runtimeTsconfigPath} to exclude the test files from. ` +
        `If you're using a different filename for your runtime tsconfig, please provide it with the '--runtimeTsconfigFileName' flag.`
    );
  }
}

function createFiles(
  tree: Tree,
  options: VitestGeneratorSchema,
  projectRoot: string
) {
  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const rootOffset = offsetFromRoot(projectRoot);

  generateFiles(tree, join(__dirname, 'files'), projectRoot, {
    tmpl: '',
    ...options,
    projectRoot,
    extendedConfig: isTsSolutionSetup
      ? `${rootOffset}tsconfig.base.json`
      : './tsconfig.json',
    outDir: isTsSolutionSetup
      ? `./out-tsc/vitest`
      : `${rootOffset}dist/out-tsc`,
  });
}

function getCoverageProviderDependency(
  coverageProvider: VitestGeneratorSchema['coverageProvider']
) {
  switch (coverageProvider) {
    case 'v8':
      return {
        '@vitest/coverage-v8': vitestCoverageV8Version,
      };
    case 'istanbul':
      return {
        '@vitest/coverage-istanbul': vitestCoverageIstanbulVersion,
      };
    default:
      return {
        '@vitest/coverage-v8': vitestCoverageV8Version,
      };
  }
}

function tryFindSetupFile(tree: Tree, projectRoot: string) {
  const setupFile = joinPathFragments('src', 'test-setup.ts');
  if (tree.exists(joinPathFragments(projectRoot, setupFile))) {
    return setupFile;
  }
}

export default vitestGenerator;
