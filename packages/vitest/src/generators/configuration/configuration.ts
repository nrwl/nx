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
  type TargetConfiguration,
  type TargetDefaults,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { upsertTargetDefault } from '@nx/devkit/internal';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  ensureTypescript,
  getProjectType,
  isUsingTsSolutionSetup,
  typesNodeVersion,
} from '@nx/js/internal';
import { join } from 'path';
import { ensureDependencies } from '../../utils/ensure-dependencies';
import {
  addOrChangeTestTarget,
  createOrEditViteConfig,
} from '../../utils/generator-utils';
import initGenerator from '../init/init';
import { VitestGeneratorSchema } from './schema';
import { detectUiFramework } from '../../utils/detect-ui-framework';
import { getInstalledViteMajorVersion } from '../../utils/version-utils';
import { getInstalledVitestMajorVersion, versions } from '../../utils/versions';
import { assertSupportedVitestVersion } from '../../utils/assert-supported-vitest-version';
import { clean, coerce, major } from 'semver';
import type {
  ExportAssignment,
  Expression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'typescript';

let ts: typeof import('typescript');

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
  assertSupportedVitestVersion(tree);

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
        const angularMajorVersion = getAngularMajorVersion(tree);
        const zoneless =
          schema.zoneless ?? isZonelessProject(tree, schema.project);

        if (angularMajorVersion >= 21) {
          tree.write(
            setupFile,
            `import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

setupTestBed(${zoneless ? '' : '{ zoneless: false }'});
`
          );
        } else if (angularMajorVersion === 20) {
          tree.write(
            setupFile,
            `import '@angular/compiler';
import '@analogjs/vitest-angular/${zoneless ? 'setup-snapshots' : 'setup-zone'}';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);
`
          );
        } else {
          tree.write(
            setupFile,
            `import '@analogjs/vitest-angular/${zoneless ? 'setup-snapshots' : 'setup-zone'}';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
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
          rolldownOptionsExternal: [
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
    const nxJson = readNxJson(tree) ?? {};
    const testTarget = schema.testTarget ?? 'test';
    const existing = findTestDefault(nxJson.targetDefaults, testTarget);
    const dependsOn = Array.from(
      new Set([...(existing?.dependsOn ?? []), '^build'])
    );
    upsertTargetDefault(tree, nxJson, { target: testTarget, dependsOn });
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

  // Setup the root config aggregating the project configs. Vitest 4 removed
  // workspace files in favor of inlining the projects into a root vitest.config
  // via `test.projects` (https://vitest.dev/guide/migration.html#workspace-is-replaced-with-projects).
  // Emit that shape for vitest 4+ and when the installed version can't be
  // detected (new installs resolve to v4); vitest 3 keeps the workspace file.
  if (!isRootProject) {
    const projectGlobs = `'**/vite.config.{mjs,js,ts,mts}', '**/vitest.config.{mjs,js,ts,mts}'`;
    const vitestMajorVersion = getInstalledVitestMajorVersion(tree);

    if (vitestMajorVersion === null || vitestMajorVersion >= 4) {
      const hasWorkspaceFile = ['ts', 'js', 'json'].some(
        (ext) =>
          tree.exists(`vitest.workspace.${ext}`) ||
          tree.exists(`vitest.projects.${ext}`)
      );
      const rootVitestConfig = findRootConfig(tree, 'vitest.config');
      const rootViteConfig = findRootConfig(tree, 'vite.config');

      if (hasWorkspaceFile) {
        // A workspace/projects file already defines the project set and the
        // vitest 4 migration converts it; leave it untouched.
      } else if (rootVitestConfig) {
        // A root vitest.config.* wins vitest's config resolution, so we can
        // neither add a competing aggregator nor safely rewrite it. Warn when it
        // doesn't aggregate, or when its shape can't be read statically, since
        // the new project would otherwise be silently absent from
        // workspace-level vitest runs.
        const declaresProjects = rootConfigDeclaresProjects(
          tree,
          rootVitestConfig
        );
        if (declaresProjects === 'missing') {
          logger.warn(
            `Found a root "${rootVitestConfig}" without a \`test.projects\` entry. ` +
              `The "${schema.project}" project won't be part of workspace-level ` +
              `vitest runs until you add its config file to \`test.projects\` there.`
          );
        } else if (declaresProjects === 'unknown') {
          logger.warn(
            `Found a root "${rootVitestConfig}" whose test setup couldn't be ` +
              `analyzed. If the "${schema.project}" project isn't picked up by ` +
              `workspace-level vitest runs, add its config file to ` +
              `\`test.projects\` there.`
          );
        }
      } else if (rootViteConfig) {
        // A root vite.config.* is vitest's config today. Writing a
        // vitest.config.* would win resolution and shadow it, dropping the vite
        // settings (aliases, plugins) from vitest runs, and projects don't
        // inherit those from a root aggregator either. Leave it in place.
        const declaresProjects = rootConfigDeclaresProjects(
          tree,
          rootViteConfig
        );
        if (declaresProjects === 'missing') {
          logger.warn(
            `Found a root "${rootViteConfig}" without a \`test.projects\` entry. ` +
              `The "${schema.project}" project runs through that root config, so ` +
              `its own vitest configuration (e.g. \`environment\`, \`setupFiles\`) ` +
              `won't apply. Add its config file to a \`test.projects\` entry there ` +
              `to run it with its own configuration.`
          );
        } else if (declaresProjects === 'unknown') {
          logger.warn(
            `Found a root "${rootViteConfig}" whose test setup couldn't be ` +
              `analyzed. If the "${schema.project}" project isn't picked up by ` +
              `workspace-level vitest runs, add its config file to ` +
              `\`test.projects\` there.`
          );
        }
      } else {
        // No root config exists, so emit the aggregator. Its projects glob
        // matches every vite/vitest config, including this file itself and any
        // root vite.config added later; exclude both so neither is resolved as
        // an extra project that, carrying no `include`, re-runs every spec via
        // the default glob.
        tree.write(
          'vitest.config.ts',
          `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [${projectGlobs}, '!vitest.config.{mjs,js,ts,mts}', '!vite.config.{mjs,js,ts,mts}'],
  },
});
`
        );
      }
    } else if (
      !tree.exists(`vitest.workspace.ts`) &&
      !tree.exists(`vitest.workspace.js`) &&
      !tree.exists(`vitest.workspace.json`) &&
      !tree.exists(`vitest.projects.ts`) &&
      !tree.exists(`vitest.projects.js`) &&
      !tree.exists(`vitest.projects.json`)
    ) {
      tree.write('vitest.workspace.ts', `export default [${projectGlobs}];`);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addTypeIfMissing(json: any, type: string): void {
  if (json.compilerOptions?.types?.includes(type)) {
    return;
  }
  if (json.compilerOptions?.types) {
    json.compilerOptions.types.push(type);
  } else {
    json.compilerOptions ??= {};
    json.compilerOptions.types = [type];
  }
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
        // vite/client is correct for anything vitest runs through vite;
        // guarded so it's a no-op when react/vue already set it.
        addTypeIfMissing(json, 'vitest');
        addTypeIfMissing(json, 'vite/client');

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
        addTypeIfMissing(json, 'vitest');
        addTypeIfMissing(json, 'vite/client');
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

function getCoverageProviderDependency(
  tree: Tree,
  coverageProvider: VitestGeneratorSchema['coverageProvider']
): Record<string, string> {
  const { vitestCoverageV8Version, vitestCoverageIstanbulVersion } =
    versions(tree);
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

function getAngularMajorVersion(tree: Tree): number {
  const angularVersion = getDependencyVersionFromPackageJson(
    tree,
    '@angular/core'
  );

  if (!angularVersion) {
    // assume the latest version will be installed
    return 21;
  }

  const cleanedAngularVersion =
    clean(angularVersion) ?? coerce(angularVersion)?.version;

  if (typeof cleanedAngularVersion !== 'string') {
    // assume the latest version will be installed
    return 21;
  }

  return major(cleanedAngularVersion);
}

function isZonelessProject(tree: Tree, projectName: string): boolean {
  const project = readProjectConfiguration(tree, projectName);

  if (project.projectType === 'application') {
    const buildTarget = findBuildTarget(project);
    if (!buildTarget?.options?.polyfills) {
      return true;
    }
    const polyfills = buildTarget.options.polyfills as string[] | string;
    const polyfillsList = Array.isArray(polyfills) ? polyfills : [polyfills];
    return !polyfillsList.includes('zone.js');
  }

  // For libraries, check if zone.js is installed in the workspace
  return getDependencyVersionFromPackageJson(tree, 'zone.js') === null;
}

function findBuildTarget(project: {
  targets?: Record<string, { executor?: string; options?: any }>;
}): { executor?: string; options?: any } | null {
  for (const target of Object.values(project.targets ?? {})) {
    if (
      [
        '@angular-devkit/build-angular:browser',
        '@angular-devkit/build-angular:browser-esbuild',
        '@angular-devkit/build-angular:application',
        '@angular/build:application',
        '@nx/angular:application',
        '@nx/angular:browser-esbuild',
        '@nx/angular:webpack-browser',
      ].includes(target.executor)
    ) {
      return target;
    }
  }

  return project.targets?.build ?? null;
}

function findTestDefault(
  td: TargetDefaults | undefined,
  target: string
): Partial<TargetConfiguration> | undefined {
  const value = td?.[target];
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const found = value.find((e) => e.filter === undefined);
    if (!found) return undefined;
    const { filter: _f, ...rest } = found;
    return rest;
  }
  return value;
}

function findRootConfig(
  tree: Tree,
  name: 'vitest.config' | 'vite.config'
): string | undefined {
  for (const ext of ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']) {
    const candidate = `${name}.${ext}`;
    if (tree.exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Classifies a root config's default export by whether it already aggregates
 * projects via `test.projects` (or the vitest 3 `test.workspace`):
 * - `'declares'`: it aggregates projects.
 * - `'missing'`: it's a readable object config with no such aggregation.
 * - `'unknown'`: the shape can't be read statically (dynamic/function configs,
 *   spreads), where the safe move is to leave the config untouched rather than
 *   shadow it.
 */
function rootConfigDeclaresProjects(
  tree: Tree,
  configPath: string
): 'declares' | 'missing' | 'unknown' {
  ts ??= ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');

  let sourceFile: SourceFile;
  try {
    sourceFile = tsquery.ast(tree.read(configPath, 'utf-8'));
  } catch {
    return 'unknown';
  }

  const exportAssignment = sourceFile.statements.find(
    (s): s is ExportAssignment => ts.isExportAssignment(s) && !s.isExportEquals
  );
  if (!exportAssignment) {
    return 'unknown';
  }

  let expression = unwrapExpression(exportAssignment.expression);
  // Unwrap a single-argument config wrapper such as `defineConfig(...)`.
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.arguments.length === 1
  ) {
    expression = unwrapExpression(expression.arguments[0]);
  }
  if (!ts.isObjectLiteralExpression(expression)) {
    return 'unknown';
  }
  // A spread could hide a `test` block we can't see.
  if (expression.properties.some((p) => ts.isSpreadAssignment(p))) {
    return 'unknown';
  }

  const testProperty = findObjectProperty(expression, 'test');
  if (!testProperty) {
    return 'missing';
  }
  if (!ts.isObjectLiteralExpression(testProperty.initializer)) {
    return 'unknown';
  }
  const testObject = testProperty.initializer;
  if (testObject.properties.some((p) => ts.isSpreadAssignment(p))) {
    return 'unknown';
  }

  return findObjectProperty(testObject, 'projects') ||
    findObjectProperty(testObject, 'workspace')
    ? 'declares'
    : 'missing';
}

function unwrapExpression(expression: Expression): Expression {
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function findObjectProperty(
  objectLiteral: ObjectLiteralExpression,
  name: string
): PropertyAssignment | undefined {
  for (const property of objectLiteral.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
    ) {
      return property;
    }
  }
  return undefined;
}

export default configurationGenerator;
