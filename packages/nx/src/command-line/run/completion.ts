import { registerCompletion } from '../completion/metadata';
import { completeProjectTarget } from '../completion/completion-providers';

registerCompletion('run', {
  positionals: [{ complete: completeProjectTarget }],
});
