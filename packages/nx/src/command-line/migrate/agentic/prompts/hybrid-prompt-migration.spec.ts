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
    expect(out).toContain('@nx/react@21.1.0 — 21-1-0-rewrite-config');
    expect(out).toContain('Rewrite the react config file format');
    expect(out).toContain(baseCtx.promptPath);
    expect(out).toContain(baseCtx.handoffFileAbsolutePath);
  });

  it('omits the description line when none is provided', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      description: undefined,
    });
    expect(out).not.toContain('Description:');
  });

  it('omits every impl section when impl is absent', () => {
    const out = buildHybridPromptUserPrompt(baseCtx);
    expect(out).not.toContain('Generator phase output');
    expect(out).not.toContain('Files modified by the generator');
    expect(out).not.toContain('Context from the generator phase');
  });

  it('renders the logs section when logs are provided, indented and ANSI-stripped', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { logs: '\x1b[1m\x1b[33mbold-yellow\x1b[0m\nplain line' },
    });
    expect(out).toContain('Generator phase output:');
    expect(out).toContain('  bold-yellow');
    expect(out).toContain('  plain line');
    expect(out).not.toMatch(/\x1b\[/);
  });

  it('omits the logs section when logs are blank or whitespace-only', () => {
    expect(
      buildHybridPromptUserPrompt({ ...baseCtx, impl: { logs: '' } })
    ).not.toContain('Generator phase output:');
    expect(
      buildHybridPromptUserPrompt({ ...baseCtx, impl: { logs: '   \n\n' } })
    ).not.toContain('Generator phase output:');
  });

  it('renders the file list when hasDiffContext is true and changes exist', () => {
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
    expect(out).toContain('Files modified by the generator phase:');
    expect(out).toContain('  [UPDATE] apps/foo/project.json');
    expect(out).toContain('  [CREATE] apps/foo/src/new.ts');
    expect(out).toContain('  [DELETE] apps/foo/src/old.ts');
    expect(out).toContain('git diff <path>');
  });

  it('omits the file list when hasDiffContext is false even if changes exist', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        hasDiffContext: false,
        changes: [change('UPDATE', 'apps/foo/project.json')],
      },
    });
    expect(out).not.toContain('Files modified by the generator phase:');
  });

  it('omits the file list when changes are empty', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: true, changes: [] },
    });
    expect(out).not.toContain('Files modified by the generator phase:');
  });

  it('renders promptContext as advisory bullets when present', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: {
        promptContext: [
          'Consumer X may need manual update',
          'Adapter Y left untouched',
        ],
      },
    });
    expect(out).toContain('Context from the generator phase (advisory');
    expect(out).toContain('  - Consumer X may need manual update');
    expect(out).toContain('  - Adapter Y left untouched');
  });

  it('drops empty / non-string promptContext entries', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { promptContext: ['', 'valid', '   ', null as any] },
    });
    // 'valid' kept; empty string dropped before render
    expect(out).toContain('  - valid');
    // empty string entry shouldn't render as a blank bullet
    expect(out).not.toMatch(/  - $/m);
  });

  it('omits all impl sections cleanly when the generator made no changes', () => {
    const out = buildHybridPromptUserPrompt({
      ...baseCtx,
      impl: { hasDiffContext: true, changes: [], logs: '', promptContext: [] },
    });
    expect(out).not.toContain('Generator phase output:');
    expect(out).not.toContain('Files modified by the generator phase:');
    expect(out).not.toContain('Context from the generator phase');
    expect(out).toContain(baseCtx.promptPath);
    expect(out).toContain(baseCtx.handoffFileAbsolutePath);
  });
});
