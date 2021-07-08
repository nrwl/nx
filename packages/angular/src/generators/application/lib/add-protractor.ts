import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  moveFilesToNewDirectory,
  getWorkspaceLayout,
  joinPathFragments,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { convertToNxProjectGenerator } from '@nrwl/workspace';

export async function addProtractor(
  host: Tree,
  options: NormalizedSchema,
  e2eProjectRoot: string
) {
  const { appsDir, standaloneAsDefault } = getWorkspaceLayout(host);

  const protractorSchematic = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'e2e'
  );

  await protractorSchematic(host, {
    relatedAppName: options.name,
    rootSelector: `${options.prefix}-root`,
  });

  if (options.standaloneConfig || standaloneAsDefault) {
    await convertToNxProjectGenerator(host, {
      project: options.e2eProjectName,
    });
  }

  moveFilesToNewDirectory(
    host,
    joinPathFragments(appsDir, e2eProjectRoot),
    options.e2eProjectRoot
  );
}
