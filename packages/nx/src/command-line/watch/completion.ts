import { registerCompletion } from '../completion/metadata';
import { getProjectNameCompletions } from '../completion/completion-providers';

registerCompletion('watch', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
  },
});
