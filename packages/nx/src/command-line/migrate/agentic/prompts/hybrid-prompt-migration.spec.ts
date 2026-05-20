import type { FileChange } from '../../../../generators/tree';
import { buildHybridPromptUserPrompt } from './hybrid-prompt-migration';

const baseCtx = {
  package: '@nx/react',
  name: '21-1-0-rewrite-config',
  version: '21.1.0',
  description: 'Rewrite the react config file format',
  promptPath: 'tools/ai-migrations/@nx/react/21.1.0/rewrite-config.md',
  handoffFileAbsolutePath: '/abs/workspace/.nx/agentic/21.1.0/step-id.json',
};

function change(type: FileChange['type'], path: string): FileChange {
  return { type, path, content: null };
}

describe('buildHybridPromptUserPrompt', () => {
  it('always includes metadata, prompt path, and handoff path', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).toMatch(
      /<migration>[\s\S]*package: @nx\/react[\s\S]*<\/migration>/
    );
    expect(out).toContain('version: 21.1.0');
    expect(out).toContain('name: 21-1-0-rewrite-config');
    expect(out).toContain('description: Rewrite the react config file format');
    expect(out).toContain(
      `<instructions_file>${baseCtx.promptPath}</instructions_file>`
    );
    expect(out).toContain(
      `<handoff_path>${baseCtx.handoffFileAbsolutePath}</handoff_path>`
    );
  });

  it('always includes a precedence note pointing to the instructions file', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).toMatch(/<precedence>[\s\S]*instructions file wins/);
  });

  it('uses a neutral lead framing that does not presuppose apply-only behavior', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).toMatch(
      /Complete the AI-driven step that follows the generator phase/
    );
    expect(out).toMatch(
      /may apply additional changes, verify the generator's output, or both/
    );
    // The old apply-only framing should be gone.
    expect(out).not.toContain('Apply the AI-driven half of a two-phase');
  });

  it('omits the description line when none is provided', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      description: undefined,
    });
    expect(out).not.toContain('description:');
  });

  it('renders a multi-line description as a YAML-style block scalar', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      description: 'Line one\nLine two\nLine three',
    });
    expect(out).toContain('description: |');
    expect(out).toContain('  Line one');
    expect(out).toContain('  Line two');
    expect(out).toContain('  Line three');
  });

  it('omits every impl section when impl is absent', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).not.toContain('<generator_output');
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    expect(out).not.toContain('<inspect_changes');
    expect(out).not.toContain('<advisory_context');
  });

  it('renders the logs section inside a fenced block when logs are provided, ANSI-stripped', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { logs: '\x1b[1m\x1b[33mbold-yellow\x1b[0m\nplain line' },
    });
    expect(out).toContain('<generator_output');
    expect(out).toContain('```\nbold-yellow\nplain line\n```');
    expect(out).toContain('</generator_output>');
    expect(out).not.toMatch(/\x1b\[/);
  });

  it('omits the logs section when logs are blank or whitespace-only', () => {
    expect(
      buildHybridPromptUserPrompt({ ...baseCtx, impl: { logs: '' } })
    ).not.toContain('<generator_output');
    expect(
      buildHybridPromptUserPrompt({ ...baseCtx, impl: { logs: '   \n\n' } })
    ).not.toContain('<generator_output');
  });

  it('omits <files_changed> and emits an <inspect_changes> git pointer when hasDiffContext is true', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        hasDiffContext: true,
        changes: [
          change('UPDATE', 'apps/foo/project.json'),
          change('CREATE', 'apps/foo/src/new.ts'),
          change('DELETE', 'apps/foo/src/old.ts'),
        ],
      },
    });
    // No embedded list under hasDiffContext.
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    // Git-inspect pointer is present, with the explicit commands.
    expect(out).toContain('<inspect_changes');
    expect(out).toMatch(/git status --porcelain=v1 -uall/);
    expect(out).toMatch(/git diff -- <path>/);
    expect(out).toMatch(/cat <path>/);
    expect(out).toMatch(
      /working tree contains only this migration's contribution/i
    );
    expect(out).toContain('</inspect_changes>');
  });

  it('embeds <files_changed> with the change list when hasDiffContext is false', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        hasDiffContext: false,
        changes: [
          change('UPDATE', 'apps/foo/project.json'),
          change('CREATE', 'apps/foo/src/new.ts'),
        ],
      },
    });
    expect(out).toMatch(/<files_changed>[\s\S]*<\/files_changed>/);
    expect(out).toContain('[UPDATE] apps/foo/project.json');
    expect(out).toContain('[CREATE] apps/foo/src/new.ts');
    // No git-inspect pointer under !hasDiffContext.
    expect(out).not.toContain('<inspect_changes');
    expect(out).not.toMatch(/git status --porcelain/);
  });

  it('omits both <files_changed> and <inspect_changes> when impl is absent', () => {
    const out = buildHybridPromptUserPrompt({ ...baseCtx, impl: undefined });
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    expect(out).not.toContain('<inspect_changes');
  });

  it('suppresses both <files_changed> and <inspect_changes> when the generator made no changes (avoids pointing the agent at an empty diff)', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: true, changes: [] },
    });
    expect(out).not.toContain('<inspect_changes');
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
  });

  it('omits <files_changed> when hasDiffContext is false and changes is empty', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: false, changes: [] },
    });
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    expect(out).not.toContain('<inspect_changes');
  });

  it('renders agentContext as advisory bullets inside the advisory_context tag', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        agentContext: [
          'Consumer X may need manual update',
          'Adapter Y left untouched',
        ],
      },
    });
    expect(out).toContain('<advisory_context');
    expect(out).toContain('- Consumer X may need manual update');
    expect(out).toContain('- Adapter Y left untouched');
    expect(out).toContain('</advisory_context>');
    // Note header uses "following" not "applying" so the advisory remains
    // accurate for validation-only hybrid prompts.
    expect(out).toContain('consult while following the instructions');
    expect(out).not.toContain('consult while applying the instructions');
  });

  it('renders multi-line agentContext entries with continuation indent so each entry stays a single list item', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        agentContext: [
          'First entry header\nSecond line of first entry\nThird line of first entry',
          'Second entry, single line',
        ],
      },
    });
    expect(out).toContain('- First entry header');
    expect(out).toContain('  Second line of first entry');
    expect(out).toContain('  Third line of first entry');
    expect(out).toContain('- Second entry, single line');
    expect(out).not.toContain('- Second line of first entry');
  });

  it('drops empty / non-string agentContext entries', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { agentContext: ['', 'valid', '   ', null as any] },
    });
    expect(out).toContain('- valid');
    expect(out).not.toMatch(/^- $/m);
  });

  it('omits all impl sections cleanly when the generator made no changes', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: true, changes: [], logs: '', agentContext: [] },
    });
    expect(out).not.toContain('<generator_output');
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    expect(out).not.toContain('<inspect_changes');
    expect(out).not.toContain('<advisory_context');
    expect(out).toContain(baseCtx.promptPath);
    expect(out).toContain(baseCtx.handoffFileAbsolutePath);
  });
});
