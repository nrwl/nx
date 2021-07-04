import { Tree, names, offsetFromRoot, updateJson } from '@nrwl/devkit';
import * as path from 'path';
import * as ts from 'typescript';
import { addRoute } from '../../../utils/nx-devkit/ast-utils';
import { NormalizedSchema } from './normalized-schema';

export function addLoadChildren(host: Tree, options: NormalizedSchema) {
  if (!host.exists(options.parentModule)) {
    throw new Error(`Cannot find '${options.parentModule}'`);
  }

  const moduleSource = host.read(options.parentModule)!.toString('utf-8');
  let sourceFile = ts.createSourceFile(
    options.parentModule,
    moduleSource,
    ts.ScriptTarget.Latest,
    true
  );

  sourceFile = addRoute(
    host,
    options.parentModule,
    sourceFile,
    `{path: '${
      names(options.fileName).fileName
    }', loadChildren: () => import('${
      options.importPath
    }').then(module => module.${options.moduleName})}`
  );

  const tsConfig = findClosestTsConfigApp(host, options.parentModule);
  if (tsConfig) {
    const offset = offsetFromRoot(path.dirname(tsConfig));
    updateJson(host, tsConfig, (json) => {
      json.include = json.include ?? [];
      json.include = [
        ...json.include,
        `${offset}${options.projectRoot}/src/index.ts`,
      ];
      return json;
    });
  } else {
    console.warn(
      `Unable to find tsconfig.json for ${options.parentModule}. Related \`includes\` for the tsconfig have not been updated.`
    );
  }
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
