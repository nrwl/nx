import { updateJsonInTree } from '@nrwl/workspace';

export default function renameWorkspaceSchematicScript() {
  return updateJsonInTree('package.json', (json) => {
    if (json.scripts && json.scripts['workspace-schematic']) {
      delete json.scripts['workspace-schematic'];
      json.scripts['workspace-generator'] = 'nx workspace-generator';
    }
    return json;
  });
}
