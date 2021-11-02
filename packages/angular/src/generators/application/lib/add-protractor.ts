import { getWorkspaceLayout, Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { moveFilesToNewDirectory, joinPathFragments } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { convertToNxProjectGenerator } from '@nrwl/workspace';

export async function addProtractor(host: Tree, options: NormalizedSchema) {
  const protractorSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'e2e'
  );

  await protractorSchematic(host, {
    relatedAppName: options.name,
    rootSelector: `${options.prefix}-root`,
  });

  if (
    options.standaloneConfig ??
    getWorkspaceLayout(host).standaloneAsDefault
  ) {
    await convertToNxProjectGenerator(host, {
      project: options.e2eProjectName,
    });
  }

  moveFilesToNewDirectory(
    host,
    joinPathFragments(options.appProjectRoot, 'e2e'),
    options.e2eProjectRoot
  );
}
