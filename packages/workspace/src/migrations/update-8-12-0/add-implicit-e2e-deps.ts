import {
  chain,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

import { updateJsonInTree } from '../../utils/ast-utils';
import { NxJson } from '../../core/shared-interfaces';
import { formatFiles } from '@nrwl/workspace/src/utils/rules/format-files';

const addE2eImplicitDependencies = updateJsonInTree<NxJson>('nx.json', json => {
  Object.keys(json.projects).forEach(proj => {
    if (proj.endsWith('-e2e') && json.projects[proj.replace(/-e2e$/, '')]) {
      json.projects[proj].implicitDependencies =
        json.projects[proj].implicitDependencies || [];
      json.projects[proj].implicitDependencies.push(proj.replace(/-e2e$/, ''));
    }
  });
  return json;
});

function showInfo(host: Tree, context: SchematicContext) {
  context.logger.info(stripIndents`
    Nx no longer infers implicit dependencies between e2e projects and their source projects based on name.
    
    These dependencies have been added to nx.json.
  `);
}

export default function(): Rule {
  return chain([showInfo, addE2eImplicitDependencies, formatFiles()]);
}
