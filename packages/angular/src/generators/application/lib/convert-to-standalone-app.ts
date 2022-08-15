import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';
import { tsquery } from '@phenomnomnominal/tsquery';

export function convertToStandaloneApp(tree: Tree, options: NormalizedSchema) {
  const pathToAppModule = joinPathFragments(
    options.appProjectRoot,
    'src/app/app.module.ts'
  );
  updateMainEntrypoint(options, tree, pathToAppModule);
  updateAppComponent(tree, options);
  if (!options.skipTests) {
    updateAppComponentSpec(tree, options);
  }

  tree.delete(pathToAppModule);
}

function updateMainEntrypoint(
  options: NormalizedSchema,
  tree: Tree,
  pathToAppModule: string
) {
  let routerModuleSetup: string;
  if (options.routing) {
    const appModuleContents = tree.read(pathToAppModule, 'utf-8');
    const ast = tsquery.ast(appModuleContents);

    const ROUTER_MODULE_SELECTOR =
      'PropertyAssignment:has(Identifier[name=imports]) CallExpression:has(PropertyAccessExpression > Identifier[name=RouterModule])';
    const nodes = tsquery(ast, ROUTER_MODULE_SELECTOR, {
      visitAllChildren: true,
    });
    if (nodes.length > 0) {
      routerModuleSetup = nodes[0].getText();
    }
  }

  tree.write(
    joinPathFragments(options.appProjectRoot, 'src/main.ts'),
    standaloneComponentMainContents(routerModuleSetup)
  );
}

const standaloneComponentMainContents = (
  routerModuleSetup
) => `import { enableProdMode${
  routerModuleSetup ? `, importProvidersFrom` : ``
} } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';${
  routerModuleSetup
    ? `
import { RouterModule } from '@angular/router'`
    : ``
};
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent${
  routerModuleSetup
    ? `, {
  providers: [importProvidersFrom(${routerModuleSetup})],
}`
    : ''
}).catch((err) => console.error(err));`;

function updateAppComponent(tree: Tree, options: NormalizedSchema) {
  const pathToAppComponent = joinPathFragments(
    options.appProjectRoot,
    'src/app/app.component.ts'
  );
  const appComponentContents = tree.read(pathToAppComponent, 'utf-8');

  const ast = tsquery.ast(appComponentContents);
  const COMPONENT_DECORATOR_SELECTOR =
    'Decorator > CallExpression:has(Identifier[name=Component])  ObjectLiteralExpression';
  const nodes = tsquery(ast, COMPONENT_DECORATOR_SELECTOR, {
    visitAllChildren: true,
  });

  if (nodes.length === 0) {
    throw new Error(
      'Could not find Component decorator within app.component.ts for standalone app generation.'
    );
  }

  const startPos = nodes[0].getStart() + 1;

  const newAppComponentContents = `import { NxWelcomeComponent } from './nx-welcome.component';${
    options.routing
      ? `
import { RouterModule } from '@angular/router';`
      : ''
  }
${appComponentContents.slice(0, startPos)}
  standalone: true,
  imports: [NxWelcomeComponent${
    options.routing ? ', RouterModule' : ''
  }],${appComponentContents.slice(startPos, -1)}`;

  tree.write(pathToAppComponent, newAppComponentContents);
}

function updateAppComponentSpec(tree: Tree, options: NormalizedSchema) {
  const pathToAppComponentSpec = joinPathFragments(
    options.appProjectRoot,
    'src/app/app.component.spec.ts'
  );
  const appComponentSpecContents = tree.read(pathToAppComponentSpec, 'utf-8');

  let newAppComponentSpecContents: string;
  if (!options.routing) {
    newAppComponentSpecContents = appComponentSpecContents.replace(
      'declarations',
      'imports'
    );
  } else {
    newAppComponentSpecContents = appComponentSpecContents
      .replace(
        'imports: [RouterTestingModule],',
        'imports: [AppComponent, NxWelcomeComponent, RouterTestingModule]'
      )
      .replace('declarations: [AppComponent, NxWelcomeComponent]', '');
  }

  tree.write(pathToAppComponentSpec, newAppComponentSpecContents);
}
