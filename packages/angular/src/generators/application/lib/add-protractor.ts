import {
  Tree,
} from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  moveFilesToNewDirectory,
  joinPathFragments,
} from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export async function addProtractor(host: Tree, options: NormalizedSchema) {
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
    joinPathFragments(options.appProjectRoot, 'e2e'),
    options.e2eProjectRoot
  );
}
