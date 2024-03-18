import { join } from 'path';
import { NormalizedJestProjectSchema } from '../schema';
import { readProjectConfiguration, Tree, updateJson } from '@nx/devkit';

export function updateTsConfig(
  host: Tree,
  options: NormalizedJestProjectSchema
) {
  const projectConfig = readProjectConfiguration(host, options.project);
  if (!host.exists(join(projectConfig.root, 'tsconfig.json'))) {
    throw new Error(
      `Expected ${join(
        projectConfig.root,
        'tsconfig.json'
      )} to exist. Please create one.`
    );
  }
  updateJson(host, join(projectConfig.root, 'tsconfig.json'), (json) => {
    if (
      json.references &&
      !json.references.some((r) => r.path === './tsconfig.spec.json')
    ) {
      json.references.push({
        path: './tsconfig.spec.json',
      });
    }
    return json;
  });
}
