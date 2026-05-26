import {
  formatDroppedAgentContextForOuterAgent,
  printDroppedAgentContextForOuterAgent,
} from './print-dropped-agent-context';

const baseMigration = { package: '@nx/react', name: '21-1-0-rewrite-config' };

describe('formatDroppedAgentContextForOuterAgent', () => {
  it('wraps the agentContext in an agent_context tag keyed by package:name, with an ℹ preamble', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: ['Consumer X may need manual update'],
    });
    expect(out).toMatch(
      /^ℹ Hints from the 21-1-0-rewrite-config generator for the AI agent driving this run:/
    );
    expect(out).toContain(
      '<agent_context migration="@nx/react:21-1-0-rewrite-config">'
    );
    expect(out).toContain('- Consumer X may need manual update');
    expect(out).toContain('</agent_context>');
  });

  it('includes the prompt path in the preamble when present', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: {
        ...baseMigration,
        prompt: 'tools/ai-migrations/@nx/react/21.1.0/rewrite-config.md',
      },
      agentContext: ['hint'],
    });
    expect(out).toMatch(
      /when applying tools\/ai-migrations\/@nx\/react\/21\.1\.0\/rewrite-config\.md/
    );
  });

  it('escapes XML-special characters in the migration attribute so hostile names cannot break the outer agent parser', () => {
    const out = formatDroppedAgentContextForOuterAgent({
      migration: { package: '@nx/has"quote', name: "fix<>&'all" },
      agentContext: ['hint'],
    });
    expect(out).toContain(
      '<agent_context migration="@nx/has&quot;quote:fix&lt;&gt;&amp;&apos;all">'
    );
    // The raw hostile chars `<`, `>`, `"`, and `'` must not appear inside the
    // attribute value. (`&` is excluded from the check because every escape
    // sequence starts with it.)
    const attr = out.match(/migration="([^"]*)"/)![1];
    expect(attr).not.toMatch(/[<>"']/);
  });

  it('returns an empty string when no usable entries remain after filtering', () => {
    expect(
      formatDroppedAgentContextForOuterAgent({
        migration: baseMigration,
        agentContext: [],
      })
    ).toBe('');
    expect(
      formatDroppedAgentContextForOuterAgent({
        migration: baseMigration,
        agentContext: ['', '   ', null as unknown as string],
      })
    ).toBe('');
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
  });

  it('writes nothing when agentContext yields no usable entries', () => {
    printDroppedAgentContextForOuterAgent({
      migration: baseMigration,
      agentContext: [],
    });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
