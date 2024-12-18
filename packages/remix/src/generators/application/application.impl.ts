import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { extractTsConfigBase } from '@nx/js/src/utils/typescript/create-ts-config';
import { dirname } from 'node:path';
import {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { updateJestTestMatch } from '../../utils/testing-config-utils';
import {
  eslintVersion,
  getPackageVersion,
  isbotVersion,
  reactDomVersion,
  reactVersion,
  remixVersion,
  typescriptVersion,
  typesReactDomVersion,
  typesReactVersion,
  viteVersion,
} from '../../utils/versions';
import initGenerator from '../init/init';
import { updateDependencies } from '../utils/update-dependencies';
import {
  addE2E,
  normalizeOptions,
  updateUnitTestConfig,
  addViteTempFilesToGitIgnore,
} from './lib';
import { NxRemixGeneratorSchema } from './schema';
import {
  addProjectToTsSolutionWorkspace,
  isUsingTsSolutionSetup,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';

export function remixApplicationGenerator(
  tree: Tree,
  options: NxRemixGeneratorSchema
) {
  return remixApplicationGeneratorInternal(tree, {
    addPlugin: true,
    ...options,
  });
}

export async function remixApplicationGeneratorInternal(
  tree: Tree,
  _options: NxRemixGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [
    await initGenerator(tree, {
      skipFormat: true,
      addPlugin: true,
    }),
    await jsInitGenerator(tree, {
      skipFormat: true,
      addTsPlugin: _options.useTsSolution,
      formatter: _options.formatter,
    }),
  ];

  const options = await normalizeOptions(tree, _options);
  if (!options.addPlugin) {
    throw new Error(
      `To generate a new Remix Vite application, you must use Inference Plugins. Check you do not have NX_ADD_PLUGINS=false or useInferencePlugins: false in your nx.json.`
    );
  }

  const isUsingTsSolution = isUsingTsSolutionSetup(tree);

  if (!isUsingTsSolution) {
    addProjectConfiguration(tree, options.projectName, {
      root: options.projectRoot,
      sourceRoot: `${options.projectRoot}`,
      projectType: 'application',
      tags: options.parsedTags,
      targets: {},
    });
  }

  const installTask = updateDependencies(tree);
  tasks.push(installTask);

  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    tree,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  const vars = {
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    remixVersion,
    isbotVersion,
    reactVersion,
    reactDomVersion,
    typesReactVersion,
    typesReactDomVersion,
    eslintVersion,
    typescriptVersion,
    viteVersion,
    isUsingTsSolution,
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files/common'),
    options.projectRoot,
    vars
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files/nx-welcome', onBoardingStatus),
    options.projectRoot,
    { ...vars, connectCloudUrl }
  );

  if (options.rootProject) {
    const gitignore = tree.read('.gitignore', 'utf-8');
    tree.write(
      '.gitignore',
      `${gitignore}\n.cache\nbuild\npublic/build\n.env\n`
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files/non-root'),
      options.projectRoot,
      vars
    );
  }

  if (isUsingTsSolution) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, 'files/ts-solution'),
      options.projectRoot,
      vars
    );
  }

  if (options.unitTestRunner !== 'none') {
    if (options.unitTestRunner === 'vitest') {
      const { vitestGenerator, createOrEditViteConfig } = ensurePackage<
        typeof import('@nx/vite')
      >('@nx/vite', getPackageVersion(tree, 'nx'));
      const vitestTask = await vitestGenerator(tree, {
        uiFramework: 'react',
        project: options.projectName,
        coverageProvider: 'v8',
        inSourceTests: false,
        skipFormat: true,
        testEnvironment: 'jsdom',
        skipViteConfig: true,
        addPlugin: true,
      });
      createOrEditViteConfig(
        tree,
        {
          project: options.projectName,
          includeLib: false,
          includeVitest: true,
          testEnvironment: 'jsdom',
          imports: [`import react from '@vitejs/plugin-react';`],
          plugins: [`react()`],
        },
        true,
        undefined,
        true
      );
      tasks.push(vitestTask);
    } else {
      const { configurationGenerator: jestConfigurationGenerator } =
        ensurePackage<typeof import('@nx/jest')>(
          '@nx/jest',
          getPackageVersion(tree, 'nx')
        );
      const jestTask = await jestConfigurationGenerator(tree, {
        project: options.projectName,
        setupFile: 'none',
        supportTsx: true,
        skipSerializers: false,
        skipPackageJson: false,
        skipFormat: true,
        addPlugin: true,
      });
      const projectConfig = readProjectConfiguration(tree, options.projectName);
      if (projectConfig.targets?.['test']?.options) {
        projectConfig.targets['test'].options.passWithNoTests = true;
        updateProjectConfiguration(tree, options.projectName, projectConfig);
      }

      tasks.push(jestTask);
    }

    const pkgInstallTask = updateUnitTestConfig(
      tree,
      options.projectRoot,
      options.unitTestRunner,
      options.rootProject
    );
    tasks.push(pkgInstallTask);
  } else {
    tree.delete(
      joinPathFragments(options.projectRoot, `tests/routes/_index.spec.tsx`)
    );
  }

  if (options.linter !== 'none') {
    const { lintProjectGenerator } = ensurePackage<typeof import('@nx/eslint')>(
      '@nx/eslint',
      getPackageVersion(tree, 'nx')
    );
    const { addIgnoresToLintConfig } = await import(
      '@nx/eslint/src/generators/utils/eslint-file'
    );
    const eslintTask = await lintProjectGenerator(tree, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
    });
    tasks.push(eslintTask);

    addIgnoresToLintConfig(tree, options.projectRoot, [
      'build',
      'public/build',
    ]);
  }

  if (options.rootProject && tree.exists('tsconfig.base.json')) {
    // If this is a standalone project, merge tsconfig.json and tsconfig.base.json.
    const tsConfigBaseJson = readJson(tree, 'tsconfig.base.json');
    updateJson(tree, 'tsconfig.json', (json) => {
      delete json.extends;
      json.compilerOptions = {
        ...tsConfigBaseJson.compilerOptions,
        ...json.compilerOptions,
        // Taken from remix default setup
        // https://github.com/remix-run/remix/blob/68c8982/templates/remix/tsconfig.json#L15-L17
        paths: {
          '~/*': ['./app/*'],
        },
      };
      json.include = [
        ...(tsConfigBaseJson.include ?? []),
        ...(json.include ?? []),
      ];
      json.exclude = [
        ...(tsConfigBaseJson.exclude ?? []),
        ...(json.exclude ?? []),
      ];
      return json;
    });
    tree.delete('tsconfig.base.json');
  } else {
    // Otherwise, extract the tsconfig.base.json from tsconfig.json so we can share settings.
    extractTsConfigBase(tree);
  }

  if (options.rootProject) {
    updateJson(tree, `package.json`, (json) => {
      json.type = 'module';
      return json;
    });

    if (options.unitTestRunner === 'jest') {
      tree.write(
        'jest.preset.js',
        `import { nxPreset } from '@nx/jest/preset.js';
export default {...nxPreset};
`
      );

      updateJestTestMatch(
        tree,
        'jest.config.ts',
        '<rootDir>/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
      );
    }
  }

  tasks.push(await addE2E(tree, options));

  // If the project package.json uses type module, and the project uses flat eslint config, we need to make sure the eslint config uses an explicit .cjs extension
  // TODO: This could be re-evaluated once we support ESM in eslint configs
  if (
    tree.exists(joinPathFragments(options.projectRoot, 'package.json')) &&
    tree.exists(joinPathFragments(options.projectRoot, 'eslint.config.js'))
  ) {
    const pkgJson = readJson(
      tree,
      joinPathFragments(options.projectRoot, 'package.json')
    );
    if (pkgJson.type === 'module') {
      tree.rename(
        joinPathFragments(options.projectRoot, 'eslint.config.js'),
        joinPathFragments(options.projectRoot, 'eslint.config.cjs')
      );
      visitNotIgnoredFiles(tree, options.projectRoot, (file) => {
        if (file.endsWith('eslint.config.js')) {
          // Replace any extends on the eslint config to use the .cjs extension
          const content = tree.read(file).toString();
          if (content.includes('eslint.config')) {
            tree.write(
              file,
              content
                .replace(/eslint\.config'/g, `eslint.config.cjs'`)
                .replace(/eslint\.config"/g, `eslint.config.cjs"`)
                .replace(/eslint\.config\.js/g, `eslint.config.cjs`)
            );
          }

          // If there is no sibling package.json with type commonjs, we need to rename the .js files to .cjs
          const siblingPackageJsonPath = joinPathFragments(
            dirname(file),
            'package.json'
          );
          if (tree.exists(siblingPackageJsonPath)) {
            const siblingPkgJson = readJson(tree, siblingPackageJsonPath);
            if (siblingPkgJson.type === 'module') {
              return;
            }
          }
          tree.rename(file, file.replace('.js', '.cjs'));
        }
      });
    }
  }

  addViteTempFilesToGitIgnore(tree);
  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  updateTsconfigFiles(
    tree,
    options.projectRoot,
    'tsconfig.app.json',
    {
      jsx: 'react-jsx',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : undefined,
    '.'
  );

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.useTsSolution) {
    addProjectToTsSolutionWorkspace(tree, options.projectRoot);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default remixApplicationGenerator;
