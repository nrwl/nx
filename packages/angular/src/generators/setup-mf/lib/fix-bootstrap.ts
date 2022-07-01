import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import type { Schema } from '../schema';

export function fixBootstrap(tree: Tree, appRoot: string, options: Schema) {
  const mainFilePath = joinPathFragments(appRoot, 'src/main.ts');
  const bootstrapCode = tree.read(mainFilePath, 'utf-8');
  tree.write(joinPathFragments(appRoot, 'src/bootstrap.ts'), bootstrapCode);

  const bootstrapImportCode = `import('./bootstrap').catch(err => console.error(err))`;

  const fetchMFManifestCode = `import { setRemoteDefinitions } from '@nrwl/angular/mf';

  fetch('/assets/module-federation.manifest.json')
  .then((res) => res.json())
  .then(definitions => setRemoteDefinitions(definitions))
  .then(() => ${bootstrapImportCode})`;

  tree.write(
    mainFilePath,
    options.mfType === 'host' && options.federationType === 'dynamic'
      ? fetchMFManifestCode
      : bootstrapImportCode
  );
}
