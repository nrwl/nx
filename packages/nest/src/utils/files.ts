import {
  apply,
  filter,
  MergeStrategy,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import { addGlobal, insert, names, offsetFromRoot } from '@nrwl/workspace';
import * as ts from 'typescript';

export function createFiles(options: any): Rule {
  return mergeWith(
    apply(url('./files/lib'), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot)
      }),
      move(options.projectRoot),
      options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('spec.ts'))
        : noop()
    ]),
    MergeStrategy.Overwrite
  );
}

export function addExportsToBarrelFile(options: any, exports: string[]): Rule {
  return (host: Tree) => {
    const indexFilePath = `${options.projectRoot}/src/index.ts`;
    const buffer = host.read(indexFilePath);
    if (!!buffer) {
      const indexSource = buffer!.toString('utf-8');
      const indexSourceFile = ts.createSourceFile(
        indexFilePath,
        indexSource,
        ts.ScriptTarget.Latest,
        true
      );

      const changes = [];

      exports.forEach(exportString =>
        changes.push(...addGlobal(indexSourceFile, indexFilePath, exportString))
      );

      insert(host, indexFilePath, changes);
    }
  };
}
