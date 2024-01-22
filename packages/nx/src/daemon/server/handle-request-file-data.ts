import { getAllFileDataInContext } from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';

export async function handleRequestFileData() {
  const response = JSON.stringify(getAllFileDataInContext(workspaceRoot));
  return {
    response,
    description: 'handleRequestFileData',
  };
}
