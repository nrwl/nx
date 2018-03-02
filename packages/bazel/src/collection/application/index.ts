import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {strings} from '@angular-devkit/core';
import {NodePackageInstallTask, RepositoryInitializerTask} from '@angular-devkit/schematics/tasks';
import {libVersions} from '../../../../shared/lib-versions';

export default function(options: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    addTasks(options, context);
    const npmScope = options.npmScope ? options.npmScope : options.name;
    const templateSource = apply(url('./files'), [
      template({
        utils: strings,
        dot: '.',
        ...libVersions,
        ...(options as object),
        npmScope
      })
    ]);
    return chain([branchAndMerge(chain([mergeWith(templateSource)]))])(host, context);
  };
}

function addTasks(options: Schema, context: SchematicContext) {
  let packageTask;
  if (!options.skipInstall) {
     packageTask = context.addTask(new NodePackageInstallTask(options.directory));
  }
  if (!options.skipGit) {
    context.addTask(new RepositoryInitializerTask(options.directory, options.commit), packageTask ? [packageTask] : []);
  }
}
