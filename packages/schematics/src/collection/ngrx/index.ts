import {
  chain,
  externalSchematic,
  move,
  Rule,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';

import { Schema } from './schema';
import * as path from 'path';

import { names, toFileName } from '../../utils/name-utils';

import {
  addImportsToModule,
  addNgRxToPackageJson,
  RequestContext,
  updateNgrxActions,
  updateNgrxEffects,
  updateNgrxReducers
} from './rules';
import { formatFiles } from '../../utils/rules/format-files';

function effectsSpec(className: string, fileName: string) {
  return `
import {TestBed} from '@angular/core/testing';
import {StoreModule} from '@ngrx/store';
import {provideMockActions} from '@ngrx/effects/testing';
import {DataPersistence} from '@nrwl/nx';
import {hot} from '@nrwl/nx/testing';

import {${className}Effects} from './${fileName}.effects';
import {Load${className}, ${className}Loaded } from './${fileName}.actions';

import { Observable } from 'rxjs';

describe('${className}Effects', () => {
  let actions$: Observable<any>;
  let effects$: ${className}Effects;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
      ],
      providers: [
        ${className}Effects,
        DataPersistence,
        provideMockActions(() => actions$)
      ],
    });

    effects$ = TestBed.get(${className}Effects);
  });

  describe('someEffect', () => {
    it('should work', () => {
      actions$ = hot('-a-|', {a: new Load${className}({})});
      expect(effects$.load${className}$).toBeObservable(
        hot('-a-|', {a: new ${className}Loaded({})})
      );
    });
  });
});
`;
}

function reducerSpec(
  className: string,
  fileName: string,
  propertyName: string
) {
  return `
import { ${className}Loaded } from './${fileName}.actions';
import { ${propertyName}Reducer, initialState } from './${fileName}.reducer';

describe('${propertyName}Reducer', () => {
  it('should work', () => {
    const action: ${className}Loaded = new ${className}Loaded({});
    const actual = ${propertyName}Reducer(initialState, action);
    expect(actual).toEqual({});
  });
});
`;
}

/**
 * Rule to generate the Nx 'ngrx' Collection
 */
export default function generateNgrxCollection(_options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(_options);
    const requestContext: RequestContext = {
      featureName: options.name,
      moduleDir: path.dirname(options.module),
      options,
      host
    };

    const fileGeneration = options.onlyEmptyRoot
      ? []
      : [
          generateNgrxFiles(requestContext),
          generateNxFiles(requestContext),
          updateNgrxActions(requestContext),
          updateNgrxReducers(requestContext),
          updateNgrxEffects(requestContext)
        ];

    const moduleModification = options.onlyAddFiles
      ? []
      : [addImportsToModule(requestContext)];
    const packageJsonModification = options.skipPackageJson
      ? []
      : [addNgRxToPackageJson()];

    return chain([
      ...fileGeneration,
      ...moduleModification,
      ...packageJsonModification,
      formatFiles(options)
    ])(host, context);
  };
}

// ********************************************************
// Internal Function
// ********************************************************

/**
 * Generate the Nx files that are NOT created by the @ngrx/schematic(s)
 */
function generateNxFiles(context: RequestContext) {
  return (host: Tree) => {
    const n = names(context.featureName);
    host.overwrite(
      path.join(
        context.moduleDir,
        context.options.directory,
        `${context.featureName}.effects.spec.ts`
      ),
      effectsSpec(n.className, n.fileName)
    );
    host.overwrite(
      path.join(
        context.moduleDir,
        context.options.directory,
        `${context.featureName}.reducer.spec.ts`
      ),
      reducerSpec(n.className, n.fileName, n.propertyName)
    );
  };
}

/**
 * Using @ngrx/schematics, generate scaffolding for 'feature': action, reducer, effect files
 */
function generateNgrxFiles(context: RequestContext) {
  return chain([
    externalSchematic('@ngrx/schematics', 'feature', {
      name: context.featureName,
      sourceDir: './',
      flat: false
    }),
    moveToNxMonoTree(
      context.featureName,
      context.moduleDir,
      context.options.directory
    )
  ]);
}

/**
 * @ngrx/schematics generates files in:
 *    `/apps/<ngrxFeatureName>/`
 *
 * For Nx monorepo, however, we need to move the files to either
 *  a) apps/<appName>/src/app/<directory>, or
 *  b) libs/<libName>/src/<directory>
 */
function moveToNxMonoTree(
  ngrxFeatureName: string,
  nxDir: string,
  directory: string
): Rule {
  return move(`app/${ngrxFeatureName}`, path.join(nxDir, directory));
}

/**
 * Extract the parent 'directory' for the specified
 */
function normalizeOptions(options: Schema): Schema {
  return { ...options, directory: toFileName(options.directory) };
}
