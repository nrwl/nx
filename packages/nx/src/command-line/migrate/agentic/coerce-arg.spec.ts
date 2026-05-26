import { coerceAgenticArg } from './coerce-arg';

describe('coerceAgenticArg', () => {
  it('passes undefined through', () => {
    expect(coerceAgenticArg(undefined)).toBeUndefined();
  });

  it('maps truthy variants to true', () => {
    expect(coerceAgenticArg(true)).toBe(true);
    expect(coerceAgenticArg('')).toBe(true);
    expect(coerceAgenticArg('true')).toBe(true);
    expect(coerceAgenticArg('yes')).toBe(true);
  });

  it('maps falsy variants to false', () => {
    expect(coerceAgenticArg(false)).toBe(false);
    expect(coerceAgenticArg('false')).toBe(false);
    expect(coerceAgenticArg('no')).toBe(false);
  });

  it('passes any other string through unchanged (upstream `.check` validates it)', () => {
    expect(coerceAgenticArg('claude-code')).toBe('claude-code');
  });

  it('falls back to undefined for unexpected types', () => {
    expect(coerceAgenticArg(42 as unknown)).toBeUndefined();
    expect(coerceAgenticArg(null as unknown)).toBeUndefined();
  });

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
