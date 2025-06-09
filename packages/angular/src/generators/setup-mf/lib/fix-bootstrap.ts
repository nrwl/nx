import { joinPathFragments, type Tree } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function fixBootstrap(
  tree: Tree,
  appRoot: string,
  options: NormalizedOptions
) {
  const mainFilePath = joinPathFragments(appRoot, 'src/main.ts');
  const bootstrapCode = tree.read(mainFilePath, 'utf-8');
  if (options.standalone && options.mfType === 'remote') {
    tree.write(
      `${appRoot}/src/bootstrap.ts`,
      standaloneBootstrapCode(
        options.componentType,
        options.componentFileSuffix
      )
    );
  } else {
    tree.write(joinPathFragments(appRoot, 'src/bootstrap.ts'), bootstrapCode);
  }

  const bootstrapImportCode = `import('./bootstrap').catch(err => console.error(err))`;
  if (options.mfType === 'remote' || options.federationType === 'static') {
    tree.write(mainFilePath, `${bootstrapImportCode};`);
  } else {
    let manifestPath = '/assets/module-federation.manifest.json';
    if (
      tree.exists(
        joinPathFragments(appRoot, 'public/module-federation.manifest.json')
      )
    ) {
      manifestPath = '/module-federation.manifest.json';
    }

    const fetchMFManifestCode = `import { init } from '@module-federation/enhanced/runtime';

fetch('${manifestPath}')
  .then((res) => res.json())
  .then((remotes: Record<string, string>) => Object.entries(remotes).map(([name, entry]) => ({ name,entry})))
  .then(remotes => init({name: '${options.appName}', remotes}))
  .then(() => ${bootstrapImportCode});`;

    tree.write(mainFilePath, fetchMFManifestCode);
  }
}

const standaloneBootstrapCode = (
  componentType: string,
  componentFileSuffix: string
) => `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry${componentType} } from './app/remote-entry/entry${componentFileSuffix}';

bootstrapApplication(RemoteEntry${componentType}, appConfig).catch((err) =>
  console.error(err)
);
`;
