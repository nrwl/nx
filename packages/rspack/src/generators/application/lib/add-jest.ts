import {
  ensurePackage,
  offsetFromRoot,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { version as nxVersion } from 'nx/package.json';
import { updateJestConfigContent } from '../../../utils/jest-utils';
import { NormalizedSchema } from '../schema';

export async function addJest(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner !== 'jest') {
    return () => {
      // nothing
    };
  }

  await ensurePackage(host, '@nrwl/jest', nxVersion);
  const { jestProjectGenerator } = await import('@nrwl/jest');

  const task = await jestProjectGenerator(host, {
    ...options,
    project: options.name,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: 'babel', // have to use babel for React projects
  });

  updateSpecConfig(host, options);

  return task;
}

function updateSpecConfig(host: Tree, options: NormalizedSchema) {
  if (options.unitTestRunner !== 'jest') {
    return;
  }
  const project = readProjectConfiguration(host, options.name);

  updateJson(host, `${project.root}/tsconfig.spec.json`, (json) => {
    const offset = offsetFromRoot(project.root);
    json.files = [
      `${offset}node_modules/@nrwl/react/typings/cssmodule.d.ts`,
      `${offset}node_modules/@nrwl/react/typings/image.d.ts`,
    ];
    return json;
  });

  const configPath = `${project.root}/jest.config.ts`;
  const originalContent = host.read(configPath, 'utf-8');
  const content = updateJestConfigContent(originalContent);
  host.write(configPath, content);
}
