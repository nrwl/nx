import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  joinPathFragments,
  logger,
  offsetFromRoot,
  ProjectType,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  getProjectType,
  isUsingTsSolutionSetup,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { typesNodeVersion } from '@nx/js/src/utils/versions';
import { join } from 'path';
import { clean, coerce, major } from 'semver';
import { detectUiFramework } from '../../utils/detect-ui-framework';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import {
  addOrChangeTestTarget,
  createOrEditViteConfig,
} from '../../utils/generator-utils';
import {
  getInstalledViteMajorVersion,
  getVitestDependenciesVersionsToInstall,
} from '../../utils/version-utils';
import initGenerator from '../init/init';
import { VitestGeneratorSchema } from './schema';

/**
 * Determines whether to use vitest.config.mts instead of vite.config.mts.
 * Returns true for new non-framework projects that don't already have a vite.config.
 */
function shouldUseVitestConfig(
  tree: Tree,
  projectRoot: string,
  uiFramework: string
): boolean {
  // Keep vite.config for framework projects (need vite plugins like react, angular, etc.)
  if (uiFramework !== 'none') {
    return false;
  }

  // Keep existing vite.config (backwards compatibility)
  const extensions = ['ts', 'mts', 'js', 'mjs'];
  const hasExistingViteConfig = extensions.some((ext) =>
    tree.exists(joinPathFragments(projectRoot, `vite.config.${ext}`))
  );
  if (hasExistingViteConfig) {
    return false;
  }

  // New non-framework project → use vitest.config.mts
  return true;
}

/**
 * @param hasPlugin some frameworks (e.g. Nuxt) provide their own plugin. Their generators handle the plugin detection.
 */
export function configurationGenerator(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false
) {
  return configurationGeneratorInternal(
    tree,
    { addPlugin: false, ...schema },
    hasPlugin
  );
}

export async function configurationGeneratorInternal(
  tree: Tree,
  schema: VitestGeneratorSchema,
  hasPlugin = false
) {
  // Setting default to jsdom since it is the most common use case (React, Web).
  // The @nx/js:lib generator specifically sets this to node to be more generic.
  schema.testEnvironment ??= 'jsdom';

  // Set the viteVersion to the installed version if it already exists in the workspace
  const installedViteVersion = getInstalledViteMajorVersion(tree);
  schema.viteVersion ??= installedViteVersion;

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
    projectRoot: root,
    viteVersion: schema.viteVersion,
    skipPackageJson: schema.skipPackageJson,
    keepExistingVersions: true,
  });
  tasks.push(initTask);

  if (!schema.skipPackageJson) {
    tasks.push(await ensureDependencies(tree, { ...schema, uiFramework }));
  }

  addOrChangeTestTarget(tree, schema, hasPlugin);

  if (!schema.skipViteConfig) {
    if (uiFramework === 'angular') {
      const relativeTestSetupPath = joinPathFragments('src', 'test-setup.ts');

      const setupFile = joinPathFragments(root, relativeTestSetupPath);
      if (!tree.exists(setupFile)) {
        if (isAngularV20(tree)) {
          tree.write(
            setupFile,
            `import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting()
);
`
          );
        } else {
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
        true,
        { skipPackageJson: schema.skipPackageJson }
      );
    } else if (uiFramework === 'react') {
      createOrEditViteConfig(
        tree,
        {
          project: schema.project,
          includeLib: getProjectType(tree, root, projectType) === 'library',
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
          coverageProvider:
            schema.coverageProvider === 'none'
              ? undefined
              : schema.coverageProvider,
          useEsmExtension: true,
        },
        true,
        { skipPackageJson: schema.skipPackageJson }
      );
    } else {
      const useVitestConfig = shouldUseVitestConfig(tree, root, uiFramework);
      createOrEditViteConfig(
        tree,
        {
          ...schema,
          includeVitest: true,
          includeLib: getProjectType(tree, root, projectType) === 'library',
          useEsmExtension: true,
        },
        true,
        {
          vitestFileName: useVitestConfig,
          skipPackageJson: schema.skipPackageJson,
        }
      );
    }
  }

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);

  createFiles(tree, schema, root, isTsSolutionSetup);
  updateTsConfig(tree, schema, root, projectType);

  if (isTsSolutionSetup) {
    // in the TS solution setup, the test target depends on the build outputs
    // so we need to setup the task pipeline accordingly
    const nxJson = readNxJson(tree);
    const testTarget = schema.testTarget ?? 'test';
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults[testTarget] ??= {};
    nxJson.targetDefaults[testTarget].dependsOn ??= [];
    nxJson.targetDefaults[testTarget].dependsOn = Array.from(
      new Set([...nxJson.targetDefaults[testTarget].dependsOn, '^build'])
    );
    updateNxJson(tree, nxJson);
  }

  const devDependencies = await getCoverageProviderDependency(
    tree,
    schema.coverageProvider
  );
  devDependencies['@types/node'] = typesNodeVersion;

  if (!schema.skipPackageJson) {
    const installDependenciesTask = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      true
    );
    tasks.push(installDependenciesTask);
  }

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
      `export default ['**/vite.config.{mjs,js,ts,mts}', '**/vitest.config.{mjs,js,ts,mts}'];`
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
    getProjectType(tree, projectRoot, projectType) === 'application'
      ? 'tsconfig.app.json'
      : 'tsconfig.lib.json'
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
  projectRoot: string,
  isTsSolutionSetup: boolean
) {
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

async function getCoverageProviderDependency(
  tree: Tree,
  coverageProvider: VitestGeneratorSchema['coverageProvider']
): Promise<Record<string, string>> {
  const { vitestCoverageV8, vitestCoverageIstanbul } =
    await getVitestDependenciesVersionsToInstall(tree);
  switch (coverageProvider) {
    case 'v8':
      return {
        '@vitest/coverage-v8': vitestCoverageV8,
      };
    case 'istanbul':
      return {
        '@vitest/coverage-istanbul': vitestCoverageIstanbul,
      };
    case 'none':
      return {};
    default:
      return {
        '@vitest/coverage-v8': vitestCoverageV8,
      };
  }
}

function tryFindSetupFile(tree: Tree, projectRoot: string) {
  const setupFile = joinPathFragments('src', 'test-setup.ts');
  if (tree.exists(joinPathFragments(projectRoot, setupFile))) {
    return setupFile;
  }
}

function isAngularV20(tree: Tree) {
  const angularVersion = getDependencyVersionFromPackageJson(
    tree,
    '@angular/core'
  );

  if (!angularVersion) {
    // assume the latest version will be installed, which will be 20 or later
    return true;
  }

  const cleanedAngularVersion =
    clean(angularVersion) ?? coerce(angularVersion).version;

  if (typeof cleanedAngularVersion !== 'string') {
    // assume the latest version will be installed,
    return true;
  }

  return major(cleanedAngularVersion) >= 20;
}

export default configurationGenerator;
