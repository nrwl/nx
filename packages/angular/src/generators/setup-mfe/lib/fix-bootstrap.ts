import type { Tree } from '@nrwl/devkit';

import { joinPathFragments } from '@nrwl/devkit';

export function fixBootstrap(host: Tree, appRoot: string) {
  const mainFilePath = joinPathFragments(appRoot, 'src/main.ts');
  const bootstrapCode = host.read(mainFilePath, 'utf-8');
  host.write(joinPathFragments(appRoot, 'src/bootstrap.ts'), bootstrapCode);

  host.write(
    mainFilePath,
    `import('./bootstrap').catch(err => console.error(err));`
  );
}
