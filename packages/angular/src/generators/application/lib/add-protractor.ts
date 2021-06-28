import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  moveFilesToNewDirectory,
  getWorkspaceLayout,
  joinPathFragments,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export async function addProtractor(
  host: Tree,
  options: NormalizedSchema,
  e2eProjectRoot: string
) {
  const { appsDir } = getWorkspaceLayout(host);

  const protractorSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'e2e'
  );

  await protractorSchematic(host, {
    relatedAppName: options.name,
    rootSelector: `${options.prefix}-root`,
  });

  moveFilesToNewDirectory(
    host,
    joinPathFragments(appsDir, e2eProjectRoot),
    options.e2eProjectRoot
  );
}
