import { chain, Rule } from '@angular-devkit/schematics';
import { checkProjectExists } from '../../utils/rules/check-project-exists';
import { formatFiles } from '../../utils/rules/format-files';
import { checkDependencies } from './lib/check-dependencies';
import { checkTargets } from './lib/check-targets';
import { removeProject } from './lib/remove-project';
import { updateNxJson } from './lib/update-nx-json';
import { updateTsconfig } from './lib/update-tsconfig';
import { updateWorkspace } from './lib/update-workspace';
import { Schema } from './schema';

export default function (schema: Schema): Rule {
  return chain([
    checkProjectExists(schema),
    checkDependencies(schema),
    checkTargets(schema),
    removeProject(schema),
    updateNxJson(schema),
    updateTsconfig(schema),
    updateWorkspace(schema),
    formatFiles(schema),
  ]);
}
