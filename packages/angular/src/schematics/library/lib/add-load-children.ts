import { Rule, Tree } from '@angular-devkit/schematics';
import { addIncludeToTsConfig, getNpmScope, insert } from '@nrwl/workspace';
import * as path from 'path';
import * as ts from 'typescript';
import { addRoute } from '../../../utils/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { names, offsetFromRoot } from '@nrwl/devkit';

export function addLoadChildren(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const npmScope = getNpmScope(host);

    if (!host.exists(options.parentModule)) {
      throw new Error(`Cannot find '${options.parentModule}'`);
    }

    const moduleSource = host.read(options.parentModule)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(
      options.parentModule,
      moduleSource,
      ts.ScriptTarget.Latest,
      true
    );

    insert(host, options.parentModule, [
      ...addRoute(
        options.parentModule,
        sourceFile,
        `{path: '${
          names(options.fileName).fileName
        }', loadChildren: () => import('${
          options.importPath
        }').then(module => module.${options.moduleName})}`
      ),
    ]);

    const tsConfig = findClosestTsConfigApp(host, options.parentModule);
    if (tsConfig) {
      const tsConfigAppSource = host.read(tsConfig)!.toString('utf-8');
      const tsConfigAppFile = ts.createSourceFile(
        tsConfig,
        tsConfigAppSource,
        ts.ScriptTarget.Latest,
        true
      );

      const offset = offsetFromRoot(path.dirname(tsConfig));
      insert(host, tsConfig, [
        ...addIncludeToTsConfig(
          tsConfig,
          tsConfigAppFile,
          `\n    , "${offset}${options.projectRoot}/src/index.ts"\n`
        ),
      ]);
    } else {
      // we should warn the user about not finding the config
    }

    return host;
  };
}

function findClosestTsConfigApp(
  host: Tree,
  parentModule: string
): string | null {
  const dir = path.parse(parentModule).dir;
  if (host.exists(`${dir}/tsconfig.app.json`)) {
    return `${dir}/tsconfig.app.json`;
  } else if (dir != '') {
    return findClosestTsConfigApp(host, dir);
  } else {
    return null;
  }
}
