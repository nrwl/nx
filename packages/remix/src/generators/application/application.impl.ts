import {
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { extractTsConfigBase } from '@nx/js/src/utils/typescript/create-ts-config';
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
} from '../../utils/versions';
import {
  NormalizedSchema,
  normalizeOptions,
  updateUnitTestConfig,
} from './lib';
import { NxRemixGeneratorSchema } from './schema';
import { updateDependencies } from '../utils/update-dependencies';
import initGenerator from '../init/init';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';

export default async function (tree: Tree, _options: NxRemixGeneratorSchema) {
  const options = await normalizeOptions(tree, _options);
  const tasks: GeneratorCallback[] = [
    await initGenerator(tree, { skipFormat: true }),
    await jsInitGenerator(tree, { skipFormat: true }),
  ];

  addBuildTargetDefaults(tree, '@nx/remix:build');

  addProjectConfiguration(tree, options.projectName, {
    root: options.projectRoot,
    sourceRoot: `${options.projectRoot}`,
    projectType: 'application',
    tags: options.parsedTags,
    targets: {
      build: {
        executor: '@nx/remix:build',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: joinPathFragments('dist', options.projectRoot),
        },
      },
      serve: {
        executor: `@nx/remix:serve`,
        options: {
          command: `${
            getPackageManagerCommand().exec
          } remix-serve build/index.js`,
          manual: true,
          port: 4200,
        },
      },
      start: {
        dependsOn: ['build'],
        command: `remix-serve build/index.js`,
        options: {
          cwd: options.projectRoot,
        },
      },
      typecheck: {
        command: `tsc`,
        options: {
          cwd: options.projectRoot,
        },
      },
    },
  });

  const installTask = updateDependencies(tree);
  tasks.push(installTask);

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
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files/common'),
    options.projectRoot,
    vars
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
      joinPathFragments(__dirname, 'files/integrated'),
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
      });
      const projectConfig = readProjectConfiguration(tree, options.projectName);
      projectConfig.targets['test'].options.passWithNoTests = true;
      updateProjectConfiguration(tree, options.projectName, projectConfig);

      tasks.push(jestTask);
    }

    const pkgInstallTask = updateUnitTestConfig(
      tree,
      options.projectRoot,
      options.unitTestRunner
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
    const eslintTask = await lintProjectGenerator(tree, {
      linter: options.linter,
      project: options.projectName,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, 'tsconfig.app.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      skipFormat: true,
      rootProject: options.rootProject,
    });
    tasks.push(eslintTask);
  }

  if (options.js) {
    toJS(tree);
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

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', getPackageVersion(tree, 'nx'));
    addFileServerTarget(tree, options, 'serve-static');
    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    tasks.push(
      await configurationGenerator(tree, {
        project: options.e2eProjectName,
        directory: 'src',
        skipFormat: true,
        devServerTarget: `${options.projectName}:serve:development`,
        baseUrl: 'http://localhost:4200',
      })
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string
) {
  const projectConfig = readProjectConfiguration(tree, options.projectName);
  projectConfig.targets[targetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.projectName}:build`,
      port: 4200,
    },
  };
  updateProjectConfiguration(tree, options.projectName, projectConfig);
}
