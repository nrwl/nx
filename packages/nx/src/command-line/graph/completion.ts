import { registerCompletion } from '../completion/metadata';
import {
  getProjectNameCompletions,
  getTargetNameCompletions,
} from '../completion/completion-providers';

registerCompletion('graph', {
  flags: {
    focus: getProjectNameCompletions,
    exclude: getProjectNameCompletions,
    targets: getTargetNameCompletions,
    target: getTargetNameCompletions,
    t: getTargetNameCompletions,
  },
});
