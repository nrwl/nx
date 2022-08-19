import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import type { Schema } from '../schema';

export function fixBootstrap(tree: Tree, appRoot: string, options: Schema) {
  const mainFilePath = joinPathFragments(appRoot, 'src/main.ts');
  const bootstrapCode = tree.read(mainFilePath, 'utf-8');
  if (options.standalone) {
    tree.write(`${appRoot}/src/bootstrap.ts`, standaloneBootstrapCode);
  } else {
    tree.write(joinPathFragments(appRoot, 'src/bootstrap.ts'), bootstrapCode);
  }

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

const standaloneBootstrapCode = `import {environment} from "./environments/environment";
import {enableProdMode, importProvidersFrom} from "@angular/core";
import {bootstrapApplication} from "@angular/platform-browser";
import {RouterModule} from "@angular/router";
import {RemoteEntryComponent} from "./app/remote-entry/entry.component";
import {RemoteRoutes} from "./app/remote-entry/routes";

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(RemoteEntryComponent, {
  providers: [
    importProvidersFrom(
      RouterModule.forRoot(RemoteRoutes, {initialNavigation: 'enabledBlocking'})
    )
  ]
});`;
