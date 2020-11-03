import { Schema } from './schema';
import { updateWorkspaceInTree } from '@nrwl/workspace';

export default function (schema: Schema) {
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
        envFile: schema.envFile,
      },
    };
    return json;
  }) as any;
}
