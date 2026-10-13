import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { assertNotUsingTsSolutionSetup } from '@nx/js/internal';
import { assertSupportedCypressVersion } from '../../utils/assert-supported-cypress-version';
import {
  assertViteSupportsInstalledCypress,
  componentTestingVersions,
  getInstalledCypressMajorVersion,
  getInstalledCypressVersion,
} from '../../utils/versions';
import { addBaseCypressSetup } from '../base-setup/base-setup';
import init, { addPlugin } from '../init/init';
import { CypressComponentConfigurationSchema } from './schema';

type NormalizeCTOptions = ReturnType<typeof normalizeOptions>;

export function componentConfigurationGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  return componentConfigurationGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

export async function componentConfigurationGeneratorInternal(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  assertSupportedCypressVersion(tree);

  assertNotUsingTsSolutionSetup(tree, 'cypress', 'component-configuration');

  const tasks: GeneratorCallback[] = [];
  const opts = normalizeOptions(options);
  if (opts.bundler === 'vite') {
    assertViteSupportsInstalledCypress(tree);
  }

  // Before init, which pins the latest cypress when none is declared. The
  // set added here can be an older one that runs on the installed Vite.
  const isCypressInstalled = !!getInstalledCypressMajorVersion(tree);
  if (!opts.skipPackageJson) {
    tasks.push(updateDeps(tree, opts));
  }

  if (!isCypressInstalled) {
    tasks.push(
      await init(tree, {
        ...opts,
        skipFormat: true,
      })
    );
  }

  await addPlugin(tree, await createProjectGraphAsync(), false);
  const projectConfig = readProjectConfiguration(tree, opts.project);

  addProjectFiles(tree, projectConfig, opts);
  updateNxJsonConfiguration(tree);

  updateTsConfigForComponentTesting(tree, projectConfig);

  if (!opts.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function normalizeOptions(options: CypressComponentConfigurationSchema) {
  return {
    ...options,
    framework: options.framework ?? null,
    directory: options.directory ?? 'cypress',
  };
}

function updateDeps(tree: Tree, opts: NormalizeCTOptions) {
  const pkgVersions = componentTestingVersions(tree, opts.bundler);

  const devDeps = {
    cypress: pkgVersions.cypressVersion,
  };
  if (!getInstalledCypressVersion(tree)) {
    // Same as init: the cypress postinstall downloads the binary it needs.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      cypress: true,
    });
  }

  if (opts.bundler === 'vite') {
    devDeps['@cypress/vite-dev-server'] =
      pkgVersions.cypressViteDevServerVersion;
  } else {
    // @cypress/webpack-dev-server depends on tsx, which depends on esbuild,
    // whose install script only validates the prebuilt binary that ships as an
    // optional dependency.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      esbuild: false,
    });
    devDeps['@cypress/webpack-dev-server'] = pkgVersions.cypressWebpackVersion;
    devDeps['html-webpack-plugin'] = pkgVersions.htmlWebpackPluginVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDeps, undefined, true);
}

function addProjectFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  opts: NormalizeCTOptions
) {
  addBaseCypressSetup(tree, {
    project: opts.project,
    directory: opts.directory,
    jsx: opts.jsx,
  });

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      ...opts,
      projectRoot: projectConfig.root,
      offsetFromRoot: offsetFromRoot(projectConfig.root),
      linter: isEslintInstalled(tree) ? 'eslint' : 'none',
      ext: '',
    }
  );
}

function updateNxJsonConfiguration(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    nxJson.namedInputs.production = Array.from(
      new Set([
        ...productionFileSet,
        '!{projectRoot}/cypress/**/*',
        '!{projectRoot}/**/*.cy.[jt]s?(x)',
        '!{projectRoot}/cypress.config.[jt]s',
      ])
    );
  }
  updateNxJson(tree, nxJson);
}

export function updateTsConfigForComponentTesting(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  let tsConfigPath: string | null = null;
  for (const candidate of ['tsconfig.lib.json', 'tsconfig.app.json']) {
    const p = joinPathFragments(projectConfig.root, candidate);
    if (tree.exists(p)) tsConfigPath = p;
  }

  if (tsConfigPath !== null) {
    updateJson(tree, tsConfigPath, (json) => {
      const excluded = new Set([
        ...(json.exclude || []),
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ]);

      json.exclude = Array.from(excluded);
      return json;
    });
  }

  const projectBaseTsConfig = joinPathFragments(
    projectConfig.root,
    'tsconfig.json'
  );
  if (tree.exists(projectBaseTsConfig)) {
    updateJson(tree, projectBaseTsConfig, (json) => {
      if (json.references) {
        const hasCyTsConfig = json.references.some((r) =>
          r.path.includes('./cypress/tsconfig.json')
        );
        if (!hasCyTsConfig) {
          json.references.push({ path: './cypress/tsconfig.json' });
        }
      } else {
        const excluded = new Set([
          ...(json.exclude || []),
          'cypress/**/*',
          'cypress.config.ts',
          '**/*.cy.ts',
          '**/*.cy.js',
          '**/*.cy.tsx',
          '**/*.cy.jsx',
        ]);

        json.exclude = Array.from(excluded);
      }
      return json;
    });
  }
}

function isEslintInstalled(tree: Tree): boolean {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!(dependencies?.eslint || devDependencies?.eslint);
}

export default componentConfigurationGenerator;
