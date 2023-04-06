import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot as _offsetFromRoot,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { version as nxVersion } from 'nx/package.json';
import * as path from 'path';
import {
  lessVersion,
  reactDomVersion,
  reactVersion,
  sassVersion,
  stylusVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';
import { configurationGenerator } from '../configuration/configuration';
import { addCypress } from './lib/add-cypress';
import { addJest } from './lib/add-jest';
import { addLinting } from './lib/add-linting';
import { createTsConfig } from './lib/create-ts-config';
import { normalizeOptions } from './lib/normalize-options';
import { ApplicationGeneratorSchema, NormalizedSchema } from './schema';

export default async function (
  tree: Tree,
  _options: ApplicationGeneratorSchema
) {
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

  const offsetFromRoot = _offsetFromRoot(options.appProjectRoot);
  generateFiles(tree, path.join(__dirname, 'files'), options.appProjectRoot, {
    ...options,
    ...names(options.name),
    offsetFromRoot,
    template: '',
  });

  createTsConfig(
    tree,
    options,
    joinPathFragments(offsetFromRoot, 'tsconfig.base.json')
  );

  const projectTask = await configurationGenerator(tree, {
    project: options.name,
    devServer: true,
    tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    framework: 'react',
    target: 'web',
    main: joinPathFragments(options.appProjectRoot, 'src/main.tsx'),
    newProject: true,
  });
  tasks.push(projectTask);

  const jestTask = await addJest(tree, options);
  tasks.push(jestTask);

  const cypressTask = await addCypress(tree, options);
  tasks.push(cypressTask);

  const lintTask = await addLinting(tree, options);
  tasks.push(lintTask);

  const installTask = addDependenciesToPackageJson(
    tree,
    { react: reactVersion, 'react-dom': reactDomVersion },
    {
      ...getStyleDependency(options),
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

function getStyleDependency(options: NormalizedSchema): Record<string, string> {
  if (options.style === 'scss') return { sass: sassVersion };
  if (options.style === 'less') return { less: lessVersion };
  if (options.style === 'styl') return { stylus: stylusVersion };
  return {};
}
