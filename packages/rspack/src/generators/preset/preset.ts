import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { version as nxVersion } from 'nx/package.json';
import * as path from 'path';

import {
  reactDomVersion,
  reactVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';
import projectGenerator from '../rspack-project/rspack-project';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { normalizeOptions } from './lib/normalize-options';
import { PresetGeneratorSchema } from './schema';

export default async function (tree: Tree, _options: PresetGeneratorSchema) {
  await ensurePackage(tree, '@nrwl/react', nxVersion);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { reactInitGenerator } = require('@nrwl/react');

  const tasks = [];
  const options = normalizeOptions(tree, _options);

  options.style ??= 'css';

  addProjectConfiguration(tree, options.name, {
    root: options.appProjectRoot,
    projectType: 'application',
    sourceRoot: `${options.appProjectRoot}/src`,
    targets: {},
  });

  generateFiles(tree, path.join(__dirname, 'files'), options.appProjectRoot, {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    template: '',
  });

  const projectTask = await projectGenerator(tree, {
    project: options.name,
    style: options.style,
    devServer: true,
    tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    uiFramework: 'react',
    target: 'web',
    main: joinPathFragments(options.appProjectRoot, 'src/main.tsx'),
  });
  tasks.push(projectTask);

  const jestTask = await addJest(tree, options);
  tasks.push(jestTask);

  const cypressTask = await addCypress(tree, options);
  tasks.push(cypressTask);

  const installTask = addDependenciesToPackageJson(
    tree,
    { react: reactVersion, 'react-dom': reactDomVersion },
    {
      '@nrwl/react': nxVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
    }
  );
  tasks.push(installTask);

  const reactInitTask = await reactInitGenerator(tree, options);
  tasks.push(reactInitTask);

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
