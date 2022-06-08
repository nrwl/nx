import { createProjectGraphAsync } from '../src/project-graph/project-graph';
import { workspaceRoot } from '../src/utils/workspace-root';
import { fileExists } from '../src/utils/fileutils';
import { join } from 'path';

(async () => {
  try {
    if (fileExists(join(workspaceRoot, 'nx.json'))) {
      await createProjectGraphAsync();
    }
  } catch (e) {
    // Do not error since this runs in a postinstall
  }
})();
