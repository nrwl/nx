import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
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
import { getRelativePathToRootTsConfig } from '@nx/js';
import { typescriptVersion } from '@nx/js/src/utils/versions';
import { execSync } from 'child_process';
import * as path from 'path';
import { addLinterToPlaywrightProject } from '../../utils/add-linter';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import { ConfigurationGeneratorSchema } from './schema';

export function configurationGenerator(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  options: ConfigurationGeneratorSchema
) {
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      addPlugin: options.addPlugin,
    })
  );
  const projectConfig = readProjectConfiguration(tree, options.project);

  const hasTsConfig = tree.exists(
    joinPathFragments(projectConfig.root, 'tsconfig.json')
  );

  const offsetFromProjectRoot = offsetFromRoot(projectConfig.root);

  generateFiles(tree, path.join(__dirname, 'files'), projectConfig.root, {
    offsetFromRoot: offsetFromProjectRoot,
    projectRoot: projectConfig.root,
    webServerCommand: options.webServerCommand ?? null,
    webServerAddress: options.webServerAddress ?? null,
    ...options,
  });

  if (!hasTsConfig) {
    tree.write(
      `${projectConfig.root}/tsconfig.json`,
      JSON.stringify(
        {
          extends: getRelativePathToRootTsConfig(tree, projectConfig.root),
          compilerOptions: {
            allowJs: true,
            outDir: `${offsetFromProjectRoot}dist/out-tsc`,
            module: 'commonjs',
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
        },
        null,
        2
      )
    );
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
    const { ModuleKind } = ensurePackage(
      'typescript',
      typescriptVersion
    ) as typeof import('typescript');
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

  return runTasksInSerial(...tasks);
}

function getBrowsersInstallTask() {
  return () => {
    output.log({
      title: 'Ensuring Playwright is installed.',
      bodyLines: ['use --skipInstall to skip installation.'],
    });
    const pmc = getPackageManagerCommand();
    execSync(`${pmc.exec} playwright install`, { cwd: workspaceRoot });
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

export default configurationGenerator;
