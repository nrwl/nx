import { coerceAgenticArg } from './cli-args';

describe('coerceAgenticArg', () => {
  it('throws when --agentic is repeated (yargs delivers an array) and echoes the received values', () => {
    expect(() => coerceAgenticArg(['claude-code', 'codex'])).toThrow(
      /--agentic was passed more than once \(received: --agentic=claude-code --agentic=codex\)/
    );
  });

  it('echoes bare-flag occurrences without a value when --agentic was repeated as a boolean toggle', () => {
    expect(() => coerceAgenticArg([true, true])).toThrow(
      /received: --agentic --agentic/
    );
  });
});
