import { createProjectGraphAsync } from '../src/project-graph/project-graph';

(async () => {
  try {
    await createProjectGraphAsync();
  } catch (e) {
    // Do not error since this runs in a postinstall
  }
})();
