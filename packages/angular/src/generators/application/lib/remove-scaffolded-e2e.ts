import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  updateProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';

export function removeScaffoldedE2e(
  host: Tree,
  { name }: NormalizedSchema,
  e2eProjectRoot: string
) {
  if (host.exists(`${e2eProjectRoot}/src/app.e2e-spec.ts`)) {
    host.delete(`${e2eProjectRoot}/src/app.e2e-spec.ts`);
  }
  if (host.exists(`${e2eProjectRoot}/src/app.po.ts`)) {
    host.delete(`${e2eProjectRoot}/src/app.po.ts`);
  }
  if (host.exists(`${e2eProjectRoot}/protractor.conf.js`)) {
    host.delete(`${e2eProjectRoot}/protractor.conf.js`);
  }
  if (host.exists(`${e2eProjectRoot}/tsconfig.json`)) {
    host.delete(`${e2eProjectRoot}/tsconfig.json`);
  }

  const project = readProjectConfiguration(host, name);
  delete project.targets['e2e'];

  updateProjectConfiguration(host, name, project);
}
