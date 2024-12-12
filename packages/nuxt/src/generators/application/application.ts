import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  runTasksInSerial,
  toJS,
  Tree,
  writeJson,
} from '@nx/devkit';
import { Schema } from './schema';
import nuxtInitGenerator from '../init/init';
import { normalizeOptions } from './lib/normalize-options';
import { createTsConfig } from '../../utils/create-ts-config';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { updateGitIgnore } from '../../utils/update-gitignore';
import { Linter } from '@nx/eslint';
import { addE2e } from './lib/add-e2e';
import { addLinting } from '../../utils/add-linting';
import { addVitest } from './lib/add-vitest';
import { vueTestUtilsVersion, vitePluginVueVersion } from '@nx/vue';
import { ensureDependencies } from './lib/ensure-dependencies';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { execSync } from 'node:child_process';
import {
  getNxCloudAppOnBoardingUrl,
  createNxCloudOnboardingURLForWelcomeApp,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { getImportPath } from '@nx/js/src/utils/get-import-path';
import { updateTsconfigFiles } from '@nx/js/src/utils/typescript/ts-solution-setup';

export async function applicationGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
    addTsPlugin: schema.useTsSolution,
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(tree, schema);

  const projectOffsetFromRoot = offsetFromRoot(options.appProjectRoot);

  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    tree,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  tasks.push(ensureDependencies(tree, options));

  if (options.isUsingTsSolutionConfig) {
    writeJson(tree, joinPathFragments(options.appProjectRoot, 'package.json'), {
      name: getImportPath(tree, options.name),
      version: '0.0.1',
      private: true,
      nx: {
        name: options.name,
        projectType: 'application',
        sourceRoot: `${options.appProjectRoot}/src`,
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
    });
  } else {
    addProjectConfiguration(tree, options.projectName, {
      root: options.appProjectRoot,
      projectType: 'application',
      sourceRoot: `${options.appProjectRoot}/src`,
      tags: options.parsedTags?.length ? options.parsedTags : undefined,
      targets: {},
    });
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files/base'),
    options.appProjectRoot,
    {
      ...options,
      offsetFromRoot: projectOffsetFromRoot,
      title: options.projectName,
      dot: '.',
      tmpl: '',
      style: options.style,
      projectRoot: options.appProjectRoot,
      hasVitest: options.unitTestRunner === 'vitest',
    }
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, './files/nx-welcome', onBoardingStatus),
    options.appProjectRoot,
    {
      ...options,
      connectCloudUrl,
      offsetFromRoot: projectOffsetFromRoot,
      title: options.projectName,
      dot: '.',
      tmpl: '',
      style: options.style,
      projectRoot: options.appProjectRoot,
      hasVitest: options.unitTestRunner === 'vitest',
    }
  );

  if (options.style === 'none') {
    tree.delete(
      joinPathFragments(options.appProjectRoot, `src/assets/css/styles.none`)
    );
  }

  createTsConfig(
    tree,
    {
      projectRoot: options.appProjectRoot,
      rootProject: options.rootProject,
      unitTestRunner: options.unitTestRunner,
      isUsingTsSolutionConfig: options.isUsingTsSolutionConfig,
    },
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );

  updateGitIgnore(tree);

  tasks.push(
    await addLinting(tree, {
      projectName: options.projectName,
      projectRoot: options.appProjectRoot,
      linter: options.linter ?? Linter.EsLint,
      unitTestRunner: options.unitTestRunner,
      rootProject: options.rootProject,
    })
  );

  if (options.unitTestRunner === 'vitest') {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@vue/test-utils': vueTestUtilsVersion,
          '@vitejs/plugin-vue': vitePluginVueVersion,
        }
      )
    );

    tasks.push(await addVitest(tree, options));
  }

  const nuxtInitTask = await nuxtInitGenerator(tree, {
    ...options,
    skipFormat: true,
  });
  tasks.push(nuxtInitTask);

  tasks.push(await addE2e(tree, options));

  if (options.js) toJS(tree);

  if (!options.skipFormat) await formatFiles(tree);

  tasks.push(() => {
    try {
      execSync(`npx -y nuxi prepare`, {
        cwd: options.appProjectRoot,

        windowsHide: false,
      });
    } catch (e) {
      console.error(
        `Failed to run \`nuxi prepare\` in "${options.appProjectRoot}". Please run the command manually.`
      );
    }
  });

  if (options.isUsingTsSolutionConfig) {
    updateTsconfigFiles(
      tree,
      options.appProjectRoot,
      'tsconfig.app.json',
      {
        jsx: 'preserve',
        jsxImportSource: 'vue',
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
      },
      options.linter === 'eslint'
        ? ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
        : undefined
    );
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
