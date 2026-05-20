import {
  formatDroppedAgentContextForOuterAgent,
  printDroppedAgentContextForOuterAgent,
} from './print-dropped-agent-context';

const baseMigration = { package: '@nx/react', name: '21-1-0-rewrite-config' };

describe('formatDroppedAgentContextForOuterAgent', () => {
  it('wraps the agentContext in an agent_context tag keyed by package:name', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: ['Consumer X may need manual update'],
    });
    expect(out).toMatch(
      /^<agent_context migration="@nx\/react:21-1-0-rewrite-config">/
    );
    expect(out).toContain('</agent_context>');
  });

  it('renders each entry as a markdown bullet', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: ['First hint', 'Second hint'],
    });
    expect(out).toContain('- First hint');
    expect(out).toContain('- Second hint');
  });

  it('preserves multi-line entries with continuation indent so each stays one list item', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: [
        'Header line\nSecond line\nThird line',
        'Single-line second entry',
      ],
    });
    expect(out).toContain('- Header line');
    expect(out).toContain('  Second line');
    expect(out).toContain('  Third line');
    expect(out).toContain('- Single-line second entry');
    expect(out).not.toContain('- Second line');
  });

  it('returns an empty string when agentContext is empty', () => {
    expect(
      formatDroppedAgentContextForOuterAgent({
        migration: baseMigration,
        agentContext: [],
      })
    ).toBe('');
  });

  it('returns an empty string when agentContext has only whitespace/null entries', () => {
    expect(
      formatDroppedAgentContextForOuterAgent({
        migration: baseMigration,
        agentContext: ['', '   ', null as unknown as string],
      })
    ).toBe('');
  });

  it('drops empty and non-string entries while keeping valid ones', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: ['', 'valid', '   ', null as unknown as string],
    });
    expect(out).toContain('- valid');
    expect(out).not.toMatch(/^- $/m);
  });
});

describe('printDroppedAgentContextForOuterAgent', () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
  });
  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('writes the formatted block to stdout with framing newlines', () => {
    printDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: ['hint A'],
    });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = writeSpy.mock.calls[0][0] as string;
    expect(written.startsWith('\n')).toBe(true);
    expect(written.endsWith('\n\n')).toBe(true);
    expect(written).toContain('<agent_context');
    expect(written).toContain('- hint A');
  });

  it('writes nothing when agentContext yields no usable entries', () => {
    printDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: [],
    });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
