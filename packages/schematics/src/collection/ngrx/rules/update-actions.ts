import * as ts from 'typescript';
import { SchematicsException, Rule, Tree } from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { toClassName } from '../../../utils/name-utils';
import {
  insert,
  addClass,
  addEnumeratorValues,
  addUnionTypes
} from '../../../utils/ast-utils';

import { RequestContext, buildNameToNgrxFile } from './request-context';

/**
 * Add custom actions to <featureName>.actions.ts
 * See Ngrx Enhancement doc:  https://bit.ly/2I5QwxQ
 *
 * Desired output:
 *
 * ```
 *    import {Action} from "@ngrx/store";
 *
 *    export enum <Feature>ActionTypes {
 *     <Feature>       = "[<Feature>] Action",
 *     Load<Feature>   = "[<Feature>] Load Data",
 *     <Feature>Loaded = "[<Feature>] Data Loaded"
 *    }
 *
 *    export class <Feature> implements Action {
 *     readonly type = <Feature>ActionTypes.<Feature>;
 *    }
 *
 *    export class Load<Feature> implements Action {
 *     readonly type = <Feature>ActionTypes.Load<Feature>;
 *     constructor(public payload: any) { }
 *    }
 *
 *    export class <Feature>LOADED implements Action {
 *     readonly type = <Feature>ActionTypes.<Feature>LOADED;
 *     constructor(public payload: any) { }
 *    }
 *
 * ```
 *
 */
export function updateNgrxActions(context: RequestContext): Rule {
  return (host: Tree) => {
    const clazzName = toClassName(context.featureName);
    const componentPath = buildNameToNgrxFile(context, 'actions.ts');
    const text = host.read(componentPath);

    if (text === null) {
      throw new SchematicsException(`File ${componentPath} does not exist.`);
    }

    const sourceText = text.toString('utf-8');
    const source = ts.createSourceFile(
      componentPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    insert(host, componentPath, [
      ...addEnumeratorValues(source, componentPath, `${clazzName}ActionTypes`, [
        {
          name: `Load${clazzName}`,
          value: `[${clazzName}] Load Data`
        },
        {
          name: `${clazzName}Loaded`,
          value: `[${clazzName}] Data Loaded`
        }
      ]),
      addClass(
        source,
        componentPath,
        `Load${clazzName}`,
        stripIndents`
        export class Load${clazzName} implements Action {
          readonly type = ${clazzName}ActionTypes.Load${clazzName};
          constructor(public payload: any) { }
        }`
      ),
      addClass(
        source,
        componentPath,
        `${clazzName}Loaded`,
        stripIndents`
        export class ${clazzName}Loaded implements Action {
          readonly type = ${clazzName}ActionTypes.${clazzName}Loaded;
          constructor(public payload: any) { }
        }`
      ),
      addUnionTypes(source, componentPath, `${clazzName}Actions`, [
        `Load${clazzName}`,
        `${clazzName}Loaded`
      ])
    ]);
  };
}
