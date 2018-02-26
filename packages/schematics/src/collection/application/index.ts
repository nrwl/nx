import {apply, branchAndMerge, chain, mergeWith, Rule, template, url, SchematicContext} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {strings} from '@angular-devkit/core';
import {RepositoryInitializerTask, NodePackageInstallTask} from '@angular-devkit/schematics/tasks';
import {libVersions} from '../utility/lib-versions';
import {wrapIntoFormat} from '../utility/tasks';

export default function(options: Schema): Rule {
  return wrapIntoFormat((context: SchematicContext) => {
    addSkipInstallAndSkipGit(options, context);

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
    return chain([branchAndMerge(chain([mergeWith(templateSource)]))]);
  });
}

function addSkipInstallAndSkipGit(options: Schema, context: SchematicContext) {
  let packageTask;
  if (!options.skipInstall) {
    packageTask = context.addTask(new NodePackageInstallTask(options.directory));
  }
  if (!options.skipGit) {
    context.addTask(new RepositoryInitializerTask(options.directory, options.commit), packageTask ? [packageTask] : []);
  }
}
