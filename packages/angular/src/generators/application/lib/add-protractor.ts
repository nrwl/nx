import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, moveFilesToNewDirectory } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

export async function addProtractor(host: Tree, options: NormalizedSchema) {
  const { wrapAngularDevkitSchematic } = require('@nrwl/devkit/ngcli-adapter');
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
