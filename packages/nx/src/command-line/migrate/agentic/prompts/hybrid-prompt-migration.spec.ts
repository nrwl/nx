import type { FileChange } from '../../../../generators/tree';
import { buildHybridPromptUserPrompt } from './hybrid-prompt-migration';

const baseCtx = {
  package: '@nx/react',
  name: '21-1-0-rewrite-config',
  version: '21.1.0',
  description: 'Rewrite the react config file format',
  promptPath: 'tools/ai-migrations/@nx/react/21.1.0/rewrite-config.md',
  handoffFileAbsolutePath:
    '/abs/workspace/.nx/migrate-runs/21.1.0/step-id.json',
};

function change(type: FileChange['type'], path: string): FileChange {
  return { type, path, content: null };
}

describe('buildHybridPromptUserPrompt', () => {
  it('always includes metadata, prompt path, handoff path, and precedence note', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).toMatch(
      /<migration>[\s\S]*package: @nx\/react[\s\S]*<\/migration>/
    );
    expect(out).toContain('name: 21-1-0-rewrite-config');
    expect(out).toContain(
      `<instructions_file>${baseCtx.promptPath}</instructions_file>`
    );
    expect(out).toContain(
      `<handoff_path>${baseCtx.handoffFileAbsolutePath}</handoff_path>`
    );
    expect(out).toMatch(/<precedence>[\s\S]*instructions file wins/);
  });

  it('omits every impl section when impl is absent', () => {
    const out = buildHybridPromptUserPrompt({ ...baseCtx, impl: undefined });
    expect(out).not.toContain('<generator_output');
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    expect(out).not.toContain('<inspect_changes');
    expect(out).not.toContain('<advisory_context');
  });

  it('renders logs inside a fenced <generator_output> block when provided', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { logs: 'line one\nline two' },
    });
    expect(out).toContain('<generator_output');
    expect(out).toContain('```\nline one\nline two\n```');
    expect(out).toContain('</generator_output>');
  });

  it('omits the logs section when logs are blank or whitespace-only', () => {
    expect(
      buildHybridPromptUserPrompt({ ...baseCtx, impl: { logs: '   \n\n' } })
    ).not.toContain('<generator_output');
  });

  it('emits <inspect_changes> with git pointers (not <files_changed>) when hasDiffContext is true', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        hasDiffContext: true,
        changes: [change('UPDATE', 'apps/foo/project.json')],
      },
    });
    expect(out).toContain('<inspect_changes');
    expect(out).toMatch(/git status --porcelain=v1 -uall/);
    expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
  });

  it('embeds <files_changed> with the [TYPE] path list when hasDiffContext is false', () => {
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
    expect(out).not.toContain('<inspect_changes');
  });

  it('suppresses both <files_changed> and <inspect_changes> when the generator made no changes', () => {
    const withDiff = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: true, changes: [] },
    });
    expect(withDiff).not.toContain('<inspect_changes');
    expect(withDiff).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);

    const withoutDiff = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: false, changes: [] },
    });
    expect(withoutDiff).not.toMatch(
      /<files_changed[^>]*>[\s\S]*<\/files_changed>/
    );
    expect(withoutDiff).not.toContain('<inspect_changes');
  });

  it('renders agentContext under <advisory_context> with a "following the instructions" framing', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { agentContext: ['hint a', 'hint b'] },
    });
    expect(out).toContain('<advisory_context');
    expect(out).toContain('- hint a');
    expect(out).toContain('- hint b');
    expect(out).toContain('</advisory_context>');
    // Note header uses "following" not "applying" so the advisory remains
    // accurate for validation-only hybrid prompts.
    expect(out).toContain('consult while following the instructions');
    expect(out).not.toContain('consult while applying the instructions');
  });
});
