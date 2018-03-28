import * as ts from 'typescript';
import { SchematicsException, Rule, Tree } from '@angular-devkit/schematics';
import {
  Change,
  NoopChange,
  RemoveChange,
  ReplaceChange
} from '@schematics/angular/utility/change';
import {
  findNodes,
  insertAfterLastOccurrence
} from '@schematics/angular/utility/ast-utils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import { toClassName, toPropertyName } from '../../../utils/name-utils';
import { insert } from '../../../utils/ast-utils';
import { RequestContext, buildNameToNgrxFile } from './request-context';

/**
 * Update ngrx-generated Reducer to confirm to DataLoaded action to <featureName>.reducer.ts
 *
 * Desired output:
 *
 * ```
 *    import { <Feature>State } from './<feature>.interfaces';
 *    import { <Feature>Actions, <Feature>ActionTypes } from './<feature>.actions';
 *
 *    import { initialState } from './<feature>.init';
 *
 *    export function <feature>Reducer(
 *          state: <Feature>State = initialState,
 *          action: <Feature>Actions): <Feature>State
 *    {
 *     switch (action.type) {
 *       case <Feature>ActionTypes.<Feature>Loaded: {
 *         return { ...state, ...action.payload };
 *       }
 *       default: {
 *         return state;
 *       }
 *     }
 *    }
 * ```
 *
 *
 */
export function updateNgrxReducers(context: RequestContext): Rule {
  return (host: Tree) => {
    const clazzName = toClassName(context.featureName);
    const componentPath = buildNameToNgrxFile(context, 'reducer.ts');
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
    const removeStateInterface = () => {
      // Remove `export interface State {  }` since we have <featureName>.interfaces.ts
      let action: Change = new NoopChange();

      findNodes(source, ts.SyntaxKind.InterfaceDeclaration)
        .filter((it: ts.InterfaceDeclaration) => it.name.getText() === 'State')
        .map((it: ts.InterfaceDeclaration) => {
          action = new RemoveChange(
            componentPath,
            it.pos + 1,
            it.getFullText()
          );
        });
      return action;
    };
    const removeInitialState = () => {
      const actions: Change[] = findNodes(
        source,
        ts.SyntaxKind.VariableStatement
      )
        .filter((it: ts.VariableStatement) => {
          return findNodes(it, ts.SyntaxKind.Identifier).reduce(
            (found: boolean, it) => it.getText() === 'State',
            false
          );
        })
        .map((it: ts.VariableStatement) => {
          return new RemoveChange(componentPath, it.pos, it.getFullText());
        });
      return actions.length ? actions[0] : new NoopChange();
    };
    const updateReducerFn = () => {
      let actions: Change[] = [];
      findNodes(source, ts.SyntaxKind.FunctionDeclaration)
        .filter((it: ts.FunctionDeclaration) => it.name.getText() === 'reducer')
        .map((it: ts.FunctionDeclaration) => {
          const fnName: ts.Identifier = it.name;
          const typeName = findNodes(it, ts.SyntaxKind.Identifier).reduce(
            (result: ts.Identifier, it: ts.Identifier): ts.Identifier => {
              return !!result
                ? result
                : it.getText() === 'State' ? it : undefined;
            },
            undefined
          );

          actions = [
            new ReplaceChange(
              componentPath,
              fnName.pos,
              fnName.getText(),
              `${toPropertyName(context.featureName)}Reducer`
            ),
            new ReplaceChange(
              componentPath,
              typeName.pos,
              typeName.getText(),
              `${clazzName}`
            )
          ];
        });

      return actions;
    };
    const updateSwitchStatement = () => {
      const toInsert = `
        
    case ${clazzName}ActionTypes.${clazzName}Loaded: {
      return { ...state, ...action.payload };
    }`;
      return insertAfterLastOccurrence(
        findNodes(source, ts.SyntaxKind.SwitchStatement),
        toInsert,
        componentPath,
        0,
        ts.SyntaxKind.CaseClause
      );
    };

    insert(host, componentPath, [
      removeStateInterface(),
      removeInitialState(),
      insertImport(
        source,
        modulePath,
        `${clazzName}`,
        `./${context.featureName}.interfaces`
      ),
      insertImport(
        source,
        modulePath,
        `${clazzName}Actions`,
        `./${context.featureName}.actions`
      ),
      insertImport(
        source,
        modulePath,
        'initialState',
        `./${context.featureName}.init`
      ),
      ...updateReducerFn(),
      updateSwitchStatement()
    ]);
  };
}
