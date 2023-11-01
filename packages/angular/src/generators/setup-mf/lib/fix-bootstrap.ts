import type { Tree } from '@nx/devkit';
import { joinPathFragments } from '@nx/devkit';
import type { Schema } from '../schema';
import { getInstalledAngularMajorVersion } from '../../utils/version-utils';

export function fixBootstrap(tree: Tree, appRoot: string, options: Schema) {
  const mainFilePath = joinPathFragments(appRoot, 'src/main.ts');
  const bootstrapCode = tree.read(mainFilePath, 'utf-8');
  const installedAngularMajor = getInstalledAngularMajorVersion(tree);
  if (options.standalone && options.mfType === 'remote') {
    tree.write(
      `${appRoot}/src/bootstrap.ts`,
      standaloneBootstrapCode(installedAngularMajor === 14)
    );
  } else {
    tree.write(joinPathFragments(appRoot, 'src/bootstrap.ts'), bootstrapCode);
  }

  const bootstrapImportCode = `import('./bootstrap').catch(err => console.error(err))`;

  const fetchMFManifestCode = `import { setRemoteDefinitions } from '@nx/angular/mf';

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

const standaloneBootstrapCode = (
  includeEnvironments: boolean = false
) => `import {bootstrapApplication} from "@angular/platform-browser";
import {appConfig} from './app/app.config';
import {RemoteEntryComponent} from './app/remote-entry/entry.component';
${
  includeEnvironments
    ? `import {enableProdMode} from '@angular/core';
import {environment} from './environments/environment';
if(environment.production) {
  enableProdMode();
}
`
    : ``
}
bootstrapApplication(RemoteEntryComponent, appConfig).catch((err) =>
  console.error(err)
);`;
