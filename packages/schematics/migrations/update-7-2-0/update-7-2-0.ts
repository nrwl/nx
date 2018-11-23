import {
  Rule,
  chain,
  noop,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { normalize, join, Path, dirname } from '@angular-devkit/core';

import { relative } from 'path';

import { updateJsonInTree, readJsonInTree } from '../../src/utils/ast-utils';
import { getWorkspacePath } from '../../src/utils/cli-config-utils';
import { offsetFromRoot } from '../../src/utils/common';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

function getBuilders(project: any): string[] {
  return Array.from(
    new Set(Object.values<any>(project.architect).map(target => target.builder))
  );
}

const builderTypes: { [key: string]: string[] } = {
  '@angular-devkit/build-angular:karma': ['jasmine'],
  '@angular-devkit/build-angular:protractor': ['jasmine', 'jasminewd2'],
  '@nrwl/builders:jest': ['jest', 'node'],
  '@nrwl/builers:cypress': ['cypress']
};

function getTypes(host: Tree, project: any, context: SchematicContext) {
  let types = [];

  const tsConfigs = getTsConfigs(project).map(tsconfigPath =>
    readJsonInTree(host, tsconfigPath)
  );

  const tsConfigsWithNoTypes = getTsConfigs(project).filter(tsconfigPath => {
    const tsconfig = readJsonInTree(host, tsconfigPath);
    return !tsconfig.compilerOptions.types;
  });

  if (tsConfigsWithNoTypes.length > 0) {
    context.logger.warn(
      stripIndents`The following tsconfigs had no types defined: ${tsConfigsWithNoTypes.join(
        ','
      )}`
    );
    return undefined;
  }

  types = types.concat(
    ...tsConfigs.map(tsconfig => tsconfig.compilerOptions.types || [])
  );

  types = types.concat(
    ...getBuilders(project)
      .filter(builder => builder in builderTypes)
      .map(builder => builderTypes[builder])
  );

  return types.filter((type, i, arr) => arr.indexOf(type) === i); // dedupe the array;
}

function createTsConfig(project: any): Rule {
  return (host: Tree, context: SchematicContext) => {
    const tsConfigPath = join(normalize(project.root), 'tsconfig.json');
    if (host.exists(tsConfigPath)) {
      return noop();
    }
    host.create(tsConfigPath, '{}');
    const types = getTypes(host, project, context);
    if (types === undefined) {
      context.logger.warn(
        stripIndents`No types array was added to ${tsConfigPath} meaning the editor might encounter conflicts for types.}`
      );
    }
    return updateJsonInTree(tsConfigPath, () => {
      return {
        extends: `${offsetFromRoot(project.root)}tsconfig.json`,
        compilerOptions: {
          types
        }
      };
    });
  };
}

function getTsConfigs(project: any): Path[] {
  return Array.from(
    new Set<Path>(
      Object.values<any>(project.architect)
        .reduce(
          (arr: any[], target) => {
            return [
              ...arr,
              ...(target.options ? [target.options] : []),
              ...Object.values<any>(target.configurations || {})
            ] as any[];
          },
          <any[]>[]
        )
        .reduce((arr: string[], options) => {
          if (!options.tsConfig) {
            return arr;
          }
          if (!Array.isArray(options.tsConfig)) {
            return arr.includes(options.tsConfig)
              ? arr
              : [...arr, options.tsConfig];
          }
          return [
            ...arr,
            ...options.tsConfig.filter(tsconfig => !arr.includes(tsconfig))
          ];
        }, [])
        .map(tsconfig => {
          return normalize(tsconfig);
        })
    )
  );
}

function updateTsConfig(project: any, tsconfig: Path): Rule {
  return updateJsonInTree(tsconfig, json => {
    json.extends =
      dirname(tsconfig) === normalize(project.root)
        ? './tsconfig.json'
        : relative(dirname(tsconfig), join(project.root, 'tsconfig.json'));
    return json;
  });
}

function updateTsConfigs(project: any): Rule {
  return (host: Tree, context: SchematicContext) => {
    return chain(
      getTsConfigs(project).map(tsconfig => updateTsConfig(project, tsconfig))
    );
  };
}

function updateProjects(host: Tree) {
  const { projects } = readJsonInTree(host, getWorkspacePath(host));
  return chain(
    Object.values<any>(projects).map(project => {
      return chain([createTsConfig(project), updateTsConfigs(project)]);
    })
  );
}

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger
    .info(stripIndents`With this update, we are changing the structure of the tsconfig files.
    A tsconfig.json has been added to all project roots which is used by editors to provide intellisense.
    The tsconfig.(app|lib|spec|e2e).json files now all extend off of the tsconfig.json in the project root.
    To find out more, visit our wiki: https://github.com/nrwl/nx/wiki/Workspace-Organization#tsconfigs`);
}

export default function(): Rule {
  return chain([updateProjects, displayInformation]);
}
