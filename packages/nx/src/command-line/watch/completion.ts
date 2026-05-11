import { registerCompletion } from '../completion/metadata';
import { getProjectNameCompletions } from '../completion/completion-providers';

// `nx watch` — no positionals; project completion comes from -p/--projects.
registerCompletion('watch', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
  },
});
