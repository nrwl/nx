import { Rule } from '@angular-devkit/schematics';
import { Schema } from './schema';
import { updateWorkspaceInTree } from '@nrwl/workspace';

export default function (schema: Schema): Rule {
  return updateWorkspaceInTree((json) => {
    const project = json.projects[schema.project];
    if (!project) {
      throw new Error(`Invalid project name "${schema.project}"`);
    }
    project.architect = project.architect || {};
    project.architect[schema.name] = {
      builder: '@nrwl/workspace:run-commands',
      outputs: schema.outputs
        ? schema.outputs.split(',').map((s) => s.trim())
        : [],
      options: {
        command: schema.command,
        cwd: schema.cwd,
      },
    };
    return json;
  });
}
