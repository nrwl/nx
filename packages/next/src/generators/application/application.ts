import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import {
  testingLibraryDomVersion,
  testingLibraryReactVersion,
} from '@nx/react/src/utils/versions';
import { getReactDependenciesVersionsToInstall } from '@nx/react/src/utils/version-utils';

import { normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';
import { addE2e } from './lib/add-e2e';
import { addJest } from './lib/add-jest';
import { addProject } from './lib/add-project';
import { createApplicationFiles } from './lib/create-application-files';
import { setDefaults } from './lib/set-defaults';
import { nextInitGenerator } from '../init/init';
import { addStyleDependencies } from '../../utils/styles';
import { addLinting } from './lib/add-linting';
import { customServerGenerator } from '../custom-server/custom-server';
import { updateCypressTsConfig } from './lib/update-cypress-tsconfig';
import { showPossibleWarnings } from './lib/show-possible-warnings';
import { tsLibVersion } from '../../utils/versions';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import {
  addProjectToTsSolutionWorkspace,
  shouldConfigureTsSolutionSetup,
  updateTsconfigFiles,
} from '@nx/js/src/utils/typescript/ts-solution-setup';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import { configureForSwc } from '../../utils/add-swc-to-custom-server';
import { updateJestConfig } from '../../utils/jest-config-util';

export async function applicationGenerator(host: Tree, schema: Schema) {
  return await applicationGeneratorInternal(host, {
    addPlugin: false,
    useProjectJson: true,
    ...schema,
  });
}

export async function applicationGeneratorInternal(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const addTsPlugin = shouldConfigureTsSolutionSetup(
    host,
    schema.addPlugin,
    schema.useTsSolution
  );
  const jsInitTask = await jsInitGenerator(host, {
    js: schema.js,
    skipPackageJson: schema.skipPackageJson,
    skipFormat: true,
    addTsPlugin,
    formatter: schema.formatter,
    platform: 'web',
  });
  tasks.push(jsInitTask);

  const options = await normalizeOptions(host, schema);
  showPossibleWarnings(host, options);

  const nextTask = await nextInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(nextTask);

  createApplicationFiles(host, options);

  addProject(host, options);

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (options.isTsSolutionSetup) {
    await addProjectToTsSolutionWorkspace(host, options.appProjectRoot);
  }

  const e2eTask = await addE2e(host, options);
  tasks.push(e2eTask);

  const jestTask = await addJest(host, options);
  tasks.push(jestTask);

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  if (options.style === 'tailwind') {
    const tailwindTask = await setupTailwindGenerator(host, {
      project: options.projectName,
    });

    tasks.push(tailwindTask);
  }

  const styledTask = addStyleDependencies(host, {
    style: options.style,
    swc: !host.exists(joinPathFragments(options.appProjectRoot, '.babelrc')),
  });
  tasks.push(styledTask);

  updateJestConfig(host, { ...options, projectRoot: options.appProjectRoot });
  updateCypressTsConfig(host, options);
  setDefaults(host, options);

  if (options.swc) {
    const swcTask = configureForSwc(host, options.appProjectRoot);
    tasks.push(swcTask);
  }

  if (options.customServer) {
    await customServerGenerator(host, {
      project: options.projectName,
      compiler: options.swc ? 'swc' : 'tsc',
    });
  }

  if (!options.skipPackageJson) {
    const reactVersions = await getReactDependenciesVersionsToInstall(host);
    const devDependencies: Record<string, string> = {
      '@types/react': reactVersions['@types/react'],
      '@types/react-dom': reactVersions['@types/react-dom'],
    };

    if (options.unitTestRunner && options.unitTestRunner !== 'none') {
      devDependencies['@testing-library/react'] = testingLibraryReactVersion;
      devDependencies['@testing-library/dom'] = testingLibraryDomVersion;
    }

    tasks.push(
      addDependenciesToPackageJson(
        host,
        { tslib: tsLibVersion },
        devDependencies
      )
    );
  }

  updateTsconfigFiles(
    host,
    options.appProjectRoot,
    'tsconfig.json',
    {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
    },
    options.linter === 'eslint'
      ? ['.next', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs']
      : ['.next'],
    options.src ? 'src' : '.'
  );

  sortPackageJsonFields(host, options.appProjectRoot);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  tasks.push(() => {
    logShowProjectCommand(options.projectName);
  });

  return runTasksInSerial(...tasks);
}
