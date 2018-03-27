import * as ts from 'typescript';
import { SchematicsException, Rule, Tree } from '@angular-devkit/schematics';
import {
  Change,
  ReplaceChange,
  InsertChange
} from '@schematics/angular/utility/change';
import {
  findNodes,
  insertAfterLastOccurrence
} from '@schematics/angular/utility/ast-utils';
import { insertImport } from '@schematics/angular/utility/route-utils';
import { toClassName, toPropertyName } from '../../../utils/name-utils';
import { insert, findNodesOfType } from '../../../utils/ast-utils';
import { RequestContext, buildNameToNgrxFile } from './request-context';

/**
 * Update ngrx-generated Reducer to confirm to DataLoaded action to <featureName>.reducer.ts
 *
 * Desired output:
 *
 * ```
 *    import { <Feature>Actions, <Feature>ActionTypes } from './<feature>.actions';
 *
 *    export interface <Feature>State {
 *    }
 *
 *    export const initialState: <Feature>State = {
 *    };
 *
 *    export function <feature>Reducer(
 *          state : <Feature>State = initialState,
 *          action: <Feature>Actions ) : <Feature>State
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
    const propertyName = toPropertyName(context.featureName);
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
    const renameStateInterface = () => {
      const name = findNodesOfType(
        source,
        ts.SyntaxKind.InterfaceDeclaration,
        (it: ts.InterfaceDeclaration) => it.name.getText() === 'State',
        (it: ts.InterfaceDeclaration) => it.name,
        true
      );
      return new ReplaceChange(
        componentPath,
        name.pos,
        'State',
        `${clazzName}Data`
      );
    };
    const addInterfaceComments = () => {
      const node = findNodes(source, ts.SyntaxKind.InterfaceDeclaration, 1)[0];
      const toAdd = `
/**
 * Interface for the '${clazzName}' data used in
 *  - ${clazzName}State, and
 *  - ${propertyName}Reducer
 */`;
      return new InsertChange(componentPath, node.pos + 1, `\n ${toAdd}`);
    };
    const addFeatureState = () => {
      const node = findNodes(source, ts.SyntaxKind.VariableStatement, 1)[0];
      const toAdd = `
/**
 * Interface to the part of the Store containing ${clazzName}State
 * and other information related to ${clazzName}Data.
 */
export interface ${clazzName}State {
  readonly ${propertyName}: ${clazzName}Data;
}`;
      return new InsertChange(componentPath, node.pos, `\n${toAdd}`);
    };
    const renameInitialState = () => {
      const getIdentifier = node => node.typeName;
      const target = findNodes(source, ts.SyntaxKind.VariableStatement, 1);
      const name = findNodesOfType(
        target[0],
        ts.SyntaxKind.TypeReference,
        it => {
          return getIdentifier(it).getText() === 'State';
        },
        it => getIdentifier(it),
        true
      );
      return new ReplaceChange(
        componentPath,
        name.pos,
        'State',
        `${clazzName}Data`
      );
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
              `${propertyName}Reducer`
            ),
            new ReplaceChange(
              componentPath,
              typeName.pos,
              typeName.getText(),
              `${clazzName}Data`
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
      addInterfaceComments(),
      addFeatureState(),
      renameStateInterface(),
      renameInitialState(),
      insertImport(
        source,
        modulePath,
        `${clazzName}Actions`,
        `./${context.featureName}.actions`
      ),
      ...updateReducerFn(),
      updateSwitchStatement()
    ]);
  };
}
