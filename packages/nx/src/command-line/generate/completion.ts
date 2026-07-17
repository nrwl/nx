import { registerCompletion } from '../completion/metadata';
import { completeGenerator } from '../completion/completion-providers';

const generateCompletion = {
  positionals: [{ complete: completeGenerator }],
};
registerCompletion('generate', generateCompletion);
registerCompletion('g', generateCompletion); // alias
