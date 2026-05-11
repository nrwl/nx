import { registerCompletion } from '../completion/metadata';
import { completeGenerator } from '../completion/completion-providers';

// `nx generate <plugin>:<generator>` — single first positional. After the
// generator is chosen, generator-specific flags are owned by the generator's
// own schema, so we fall through past positional 0.
const generateCompletion = {
  positionals: [{ complete: completeGenerator }],
};
registerCompletion('generate', generateCompletion);
registerCompletion('g', generateCompletion); // alias
