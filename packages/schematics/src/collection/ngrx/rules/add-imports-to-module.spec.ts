import { of as observableOf } from 'rxjs/observable/of';

import {
  Tree,
  VirtualTree,
  SchematicContext
} from '@angular-devkit/schematics';
import { callRule } from '@angular-devkit/schematics/src/rules/call';
import { getFileContent } from '@schematics/angular/utility/test';

import { RequestContext } from './request-context';
import { addImportsToModule } from './add-imports-to-module';
import { findModuleParent } from '../../../utils/name-utils';

describe('ngrx', () => {
  it('should add imports to ngModule with missing metadata', done => {
    const context: SchematicContext = null!;
    const modulePath = '/apps/myapp/src/app/app.module.ts';
    const moduleContent = `
            import {NgModule} from '@angular/core';
            
            @NgModule({ })
            export class AppModule {
            }
        `;
    const tree = new VirtualTree();
    const request = buildRequestContext(tree, modulePath, 'User');

    tree.create(modulePath, moduleContent);

    callRule(addImportsToModule(request), observableOf(tree), context)
      .toPromise()
      .then(result => {
        const appModule = getFileContent(result, modulePath);

        expect(appModule).toContain('CommonModule, ');
        expect(appModule).toContain(', EffectsModule.forRoot([UserEffects])');
      })
      .then(done, done.fail);
  });

  it('should add imports to ngModule with empty imports metadata', done => {
    const context: SchematicContext = null!;
    const modulePath = '/apps/myapp/src/app/app.module.ts';
    const moduleContent = `
          import {NgModule} from '@angular/core';
          @NgModule({
            imports : [ ]
          })
          export class AppModule {
          }
      `;
    const tree = new VirtualTree();
    const request = buildRequestContext(tree, modulePath, 'User');

    tree.create(modulePath, moduleContent);
    callRule(addImportsToModule(request), observableOf(tree), context)
      .toPromise()
      .then(result => {
        const appModule = getFileContent(result, modulePath);

        expect(appModule).toContain('CommonModule, ');
        expect(appModule).toContain(', EffectsModule.forRoot([UserEffects])');
      })
      .then(done, done.fail);
  });

  it('should add imports to ngModule with missing empty import-from', done => {
    const context: SchematicContext = null!;
    const modulePath = '/apps/myapp/src/app/app.module.ts';
    const moduleContent = `
        import {NgModule} from '@angular/core';
        
        @NgModule({
          imports : [ CommonModule ]
        })
        export class AppModule {
        }
    `;
    const tree = new VirtualTree();
    const request = buildRequestContext(tree, modulePath, 'User');

    tree.create(modulePath, moduleContent);

    callRule(addImportsToModule(request), observableOf(tree), context)
      .toPromise()
      .then(result => {
        const appModule = getFileContent(result, modulePath);

        expect(appModule).toContain('CommonModule, ');
        expect(appModule).toContain(', EffectsModule.forRoot([UserEffects])');
      })
      .then(done, done.fail);
  });
});

function buildRequestContext(
  tree: Tree,
  modulePath: string,
  featureName: string
): RequestContext {
  return {
    featureName: featureName,
    moduleDir: findModuleParent(modulePath),
    options: {
      name: featureName,
      onlyEmptyRoot: false,
      root: true,
      onlyAddFiles: false,
      module: modulePath,
      skipPackageJson: true,
      directory: '+state'
    },
    host: tree
  };
}
