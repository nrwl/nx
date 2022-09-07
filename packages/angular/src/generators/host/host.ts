import {
  formatFiles,
  generateFiles,
  getProjects,
  joinPathFragments,
  names,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import remoteGenerator from '../remote/remote';
import { normalizeProjectName } from '../utils/project';
import * as ts from 'typescript';
import { addRoute } from '../../utils/nx-devkit/ast-utils';
import { addStandaloneRoute } from '../../utils/nx-devkit/standalone-utils';
import { setupMf } from '../setup-mf/setup-mf';
import { E2eTestRunner } from '../../utils/test-runners';

export default async function host(tree: Tree, options: Schema) {
  const projects = getProjects(tree);

  const remotesToGenerate: string[] = [];
  const remotesToIntegrate: string[] = [];

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        remotesToGenerate.push(remote);
      } else {
        remotesToIntegrate.push(remote);
      }
    });
  }

  const appName = normalizeProjectName(options.name, options.directory);

  const installTask = await applicationGenerator(tree, {
    ...options,
    routing: true,
    port: 4200,
    skipFormat: true,
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;
  await setupMf(tree, {
    appName,
    mfType: 'host',
    routing: true,
    port: 4200,
    remotes: remotesToIntegrate ?? [],
    federationType: options.dynamic ? 'dynamic' : 'static',
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${appName}-e2e`,
  });

  for (const remote of remotesToGenerate) {
    await remoteGenerator(tree, {
      ...options,
      name: remote,
      host: appName,
      skipFormat: true,
      standalone: options.standalone,
    });
  }

  routeToNxWelcome(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function routeToNxWelcome(tree: Tree, options: Schema) {
  const { sourceRoot } = readProjectConfiguration(
    tree,
    normalizeProjectName(options.name, options.directory)
  );

  const remoteRoutes =
    options.remotes && Array.isArray(options.remotes)
      ? options.remotes.reduce(
          (routes, remote) =>
            `${routes}\n<li><a routerLink='${normalizeProjectName(
              remote,
              options.directory
            )}'>${names(remote).className}</a></li>`,
          ''
        )
      : '';

  tree.write(
    joinPathFragments(sourceRoot, 'app/app.component.html'),
    `<ul class="remote-menu">
<li><a routerLink='/'>Home</a></li>
${remoteRoutes}
</ul>
<router-outlet></router-outlet>
`
  );

  const pathToHostRootRoutingFile = joinPathFragments(
    sourceRoot,
    options.standalone ? 'bootstrap.ts' : 'app/app.module.ts'
  );
  const hostRootRoutingFile = tree.read(pathToHostRootRoutingFile, 'utf-8');

  if (!hostRootRoutingFile.includes('RouterModule.forRoot(')) {
    return;
  }

  let sourceFile = ts.createSourceFile(
    pathToHostRootRoutingFile,
    hostRootRoutingFile,
    ts.ScriptTarget.Latest,
    true
  );

  if (hostRootRoutingFile.includes('@NgModule')) {
    sourceFile = addRoute(
      tree,
      pathToHostRootRoutingFile,
      sourceFile,
      `{
         path: '', 
         component: NxWelcomeComponent
     }`
    );
  } else {
    addStandaloneRoute(
      tree,
      pathToHostRootRoutingFile,
      `{
      path: '',
      component: NxWelcomeComponent
    }`
    );

    tree.write(
      pathToHostRootRoutingFile,
      `import { NxWelcomeComponent } from './app/nx-welcome.component';
    ${tree.read(pathToHostRootRoutingFile, 'utf-8')}`
    );
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    joinPathFragments(sourceRoot, 'app'),
    {
      appName: normalizeProjectName(options.name, options.directory),
      tmpl: '',
    }
  );
}
