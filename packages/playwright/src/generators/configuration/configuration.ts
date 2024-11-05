import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  offsetFromRoot,
  output,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  workspaceRoot,
  writeJson,
} from '@nx/devkit';
import { resolveImportPath } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { normalizeLinterOption } from '@nx/js/src/utils/generator-prompts';
import {
  getProjectPackageManagerWorkspaceState,
  getProjectPackageManagerWorkspaceStateWarningTask,
} from '@nx/js/src/utils/package-manager-workspaces';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { execSync } from 'child_process';
import { PackageJson } from 'nx/src/utils/package-json';
import * as path from 'path';
import { addLinterToPlaywrightProject } from '../../utils/add-linter';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import type {
  ConfigurationGeneratorSchema,
  NormalizedGeneratorOptions,
} from './schema';

export function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  rawOptions: ConfigurationGeneratorSchema
) {
  const options = await normalizeOptions(tree, rawOptions);

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      addPlugin: options.addPlugin,
    })
  );

  const projectConfig = readProjectConfiguration(tree, options.project);
  const offsetFromProjectRoot = offsetFromRoot(projectConfig.root);

  generateFiles(tree, path.join(__dirname, 'files'), projectConfig.root, {
    offsetFromRoot: offsetFromProjectRoot,
    projectRoot: projectConfig.root,
    webServerCommand: options.webServerCommand ?? null,
    webServerAddress: options.webServerAddress ?? null,
    ...options,
  });

  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  const tsconfigPath = joinPathFragments(projectConfig.root, 'tsconfig.json');
  if (!tree.exists(tsconfigPath)) {
    const tsconfig: any = {
      extends: getRelativePathToRootTsConfig(tree, projectConfig.root),
      compilerOptions: {
        allowJs: true,
        outDir: `${offsetFromProjectRoot}dist/out-tsc`,
        sourceMap: false,
      },
      include: [
        '**/*.ts',
        '**/*.js',
        'playwright.config.ts',
        'src/**/*.spec.ts',
        'src/**/*.spec.js',
        'src/**/*.test.ts',
        'src/**/*.test.js',
        'src/**/*.d.ts',
      ],
    };

    if (isTsSolutionSetup) {
      tsconfig.compilerOptions.outDir = 'dist';
      tsconfig.compilerOptions.tsBuildInfoFile = 'dist/tsconfig.tsbuildinfo';

      if (!options.rootProject) {
        updateJson(tree, 'tsconfig.json', (json) => {
          // add the project tsconfig to the workspace root tsconfig.json references
          json.references ??= [];
          json.references.push({ path: './' + projectConfig.root });
          // skip eslint from typechecking since it may extend from root file that is outside of rootDir
          if (options.linter === 'eslint') {
            json.exclude ??= [];
            json.exclude.push('dist', 'eslint.config.js');
          }
          return json;
        });
      }
    } else {
      tsconfig.compilerOptions.outDir = `${offsetFromProjectRoot}dist/out-tsc`;
      tsconfig.compilerOptions.module = 'commonjs';
    }

    writeJson(tree, tsconfigPath, tsconfig);
  }

  if (isTsSolutionSetup) {
    const packageJsonPath = joinPathFragments(
      projectConfig.root,
      'package.json'
    );
    if (!tree.exists(packageJsonPath)) {
      const importPath = resolveImportPath(
        tree,
        projectConfig.name,
        projectConfig.root
      );

      const packageJson: PackageJson = {
        name: importPath,
        version: '0.0.1',
        private: true,
      };
      writeJson(tree, packageJsonPath, packageJson);
    }

    ignoreTestOutput(tree);
  }

  const hasPlugin = readNxJson(tree).plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/playwright/plugin'
      : p.plugin === '@nx/playwright/plugin'
  );

  if (!hasPlugin) {
    addE2eTarget(tree, options);
    setupE2ETargetDefaults(tree);
  }

  tasks.push(
    await addLinterToPlaywrightProject(tree, {
      project: options.project,
      linter: options.linter,
      skipPackageJson: options.skipPackageJson,
      js: options.js,
      directory: options.directory,
      setParserOptionsProject: options.setParserOptionsProject,
      rootProject: options.rootProject ?? projectConfig.root === '.',
      addPlugin: options.addPlugin,
    })
  );

  if (options.js) {
    const { ModuleKind } = ensureTypescript();
    toJS(tree, { extension: '.cjs', module: ModuleKind.CommonJS });
  }

  recommendVsCodeExtensions(tree);

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          // required since used in playwright config
          '@nx/devkit': nxVersion,
        }
      )
    );
  }

  if (!options.skipInstall) {
    tasks.push(getBrowsersInstallTask());
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (isTsSolutionSetup) {
    const projectPackageManagerWorkspaceState =
      getProjectPackageManagerWorkspaceState(tree, projectConfig.root);

    if (projectPackageManagerWorkspaceState !== 'included') {
      tasks.push(
        getProjectPackageManagerWorkspaceStateWarningTask(
          projectPackageManagerWorkspaceState,
          tree.root
        )
      );
    }
  }

  return runTasksInSerial(...tasks);
}

async function normalizeOptions(
  tree: Tree,
  options: ConfigurationGeneratorSchema
): Promise<NormalizedGeneratorOptions> {
  const nxJson = readNxJson(tree);
  const addPlugin =
    options.addPlugin ??
    (process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

  const linter = await normalizeLinterOption(tree, options.linter);

  return {
    ...options,
    addPlugin,
    linter,
    directory: options.directory ?? 'e2e',
  };
}

function getBrowsersInstallTask() {
  return () => {
    output.log({
      title: 'Ensuring Playwright is installed.',
      bodyLines: ['use --skipInstall to skip installation.'],
    });
    const pmc = getPackageManagerCommand();
    execSync(`${pmc.exec} playwright install`, {
      cwd: workspaceRoot,
      windowsHide: false,
    });
  };
}

function recommendVsCodeExtensions(tree: Tree): void {
  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ??= [];

      const recs = new Set(json.recommendations);
      recs.add('ms-playwright.playwright');

      json.recommendations = Array.from(recs);
      return json;
    });
  } else {
    writeJson(tree, '.vscode/extensions.json', {
      recommendations: ['ms-playwright.playwright'],
    });
  }
}

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};

  const productionFileSet = !!nxJson.namedInputs?.production;
  nxJson.targetDefaults.e2e ??= {};
  nxJson.targetDefaults.e2e.cache ??= true;
  nxJson.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

function addE2eTarget(tree: Tree, options: ConfigurationGeneratorSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (projectConfig?.targets?.e2e) {
    throw new Error(`Project ${options.project} already has an e2e target.
Rename or remove the existing e2e target.`);
  }
  projectConfig.targets ??= {};
  projectConfig.targets.e2e = {
    executor: '@nx/playwright:playwright',
    outputs: [`{workspaceRoot}/dist/.playwright/${projectConfig.root}`],
    options: {
      config: `${projectConfig.root}/playwright.config.${
        options.js ? 'cjs' : 'ts'
      }`,
    },
  };
  updateProjectConfiguration(tree, options.project, projectConfig);
}

function ignoreTestOutput(tree: Tree): void {
  if (!tree.exists('.gitignore')) {
    logger.warn(`Couldn't find a root .gitignore file to update.`);
  }

  let content = tree.read('.gitignore', 'utf-8');
  if (/^test-output$/gm.test(content)) {
    return;
  }

  content = `${content}\ntest-output\n`;
  tree.write('.gitignore', content);
}

export default configurationGenerator;
