import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

registerCompletion('run-many', {
  flags: {
    projects: getProjectNameCompletions,
    p: getProjectNameCompletions,
    targets: getTargetNameCompletions,
    target: getTargetNameCompletions,
    t: getTargetNameCompletions,
  },
});
