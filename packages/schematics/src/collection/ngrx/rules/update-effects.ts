import * as ts from 'typescript';
import { SchematicsException, Rule, Tree } from '@angular-devkit/schematics';
import { InsertChange } from '@schematics/angular/utility/change';
import { findNodes } from '@schematics/angular/utility/ast-utils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

import { toClassName } from '../../../utils/name-utils';
import { insert } from '../../../utils/ast-utils';
import { RequestContext, buildNameToNgrxFile } from './request-context';

/**
 *
 *  Desired output:
 *
 *  ```
 *  import { Injectable } from '@angular/core';
 *  import { Effect, Actions } from '@ngrx/effects';
 *  import { DataPersistence } from '@nrwl/nx';
 *
 *  import { <Feature>, <Feature>State } from './<feature>.reducer';
 *  import { Load<Feature>, <Feature>Loaded, <Feature>ActionTypes } from './<feature>.actions';
 *
 *  @Injectable()
 *  export class <Feature>Effects {
 *   @Effect() load<Feature>$ = this.dataPersistence.fetch(<Feature>ActionTypes.Load<Feature>, {
 *     run: (action: Load<Feature>, state: <Feature>State) => {
 *       return new <Feature>Loaded({});
 *     },
 *
 *     onError: (action: Load<Feature>, error) => {
 *       console.error('Error', error);
 *     }
 *   });
 *
 *   constructor(
 *     private actions: Actions,
 *     private dataPersistence: DataPersistence<<Feature>State>) { }
 *  }
 *
 */
export function updateNgrxEffects(context: RequestContext): Rule {
  return (host: Tree) => {
    const clazzName = toClassName(context.featureName);
    const componentPath = buildNameToNgrxFile(context, 'effects.ts');
    const featureReducer = `./${context.featureName}.reducer`;
    const text = host.read(componentPath);

    if (text === null) {
      throw new SchematicsException(`File ${componentPath} does not exist.`);
    }

    const modulePath = context.options.module;
    const sourceText = text.toString('utf-8');
    const source = ts.createSourceFile(
      componentPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const updateConstructor = () => {
      const astConstructor = findNodes(source, ts.SyntaxKind.Constructor)[0];
      const lastParameter = findNodes(
        astConstructor,
        ts.SyntaxKind.Parameter
      ).pop();

      return new InsertChange(
        componentPath,
        lastParameter.end,
        stripIndents`, private dataPersistence: DataPersistence<${clazzName}State>`
      );
    };
    const addEffect$ = () => {
      const toInsert = `\n
  @Effect()
  load${clazzName}$ = this.dataPersistence.fetch(${clazzName}ActionTypes.Load${clazzName}, {
   run: (action: Load${clazzName}, state: ${clazzName}State) => {
     return new ${clazzName}Loaded(state);
   },
  
   onError: (action: Load${clazzName}, error) => {
     console.error('Error', error);
   }
  });`;
      const astConstructor = findNodes(source, ts.SyntaxKind.Constructor)[0];
      return new InsertChange(componentPath, astConstructor.pos, toInsert);
    };

    const actionsFile = `./${context.featureName}.actions`;
    const actionImports = `Load${clazzName}, ${clazzName}Loaded`;

    insert(host, componentPath, [
      insertImport(source, modulePath, actionImports, actionsFile),
      insertImport(source, modulePath, `${clazzName}State`, featureReducer),
      insertImport(source, modulePath, 'DataPersistence', `@nrwl/nx`),
      updateConstructor(),
      addEffect$()
    ]);
  };
}
