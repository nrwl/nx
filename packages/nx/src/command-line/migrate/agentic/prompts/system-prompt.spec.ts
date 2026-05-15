import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const ctx = {
    workspaceRoot: '/abs/workspace',
    handoffFileAbsolutePath: '/abs/workspace/.nx/agentic/23.0.0/step-1.json',
  };

  it('embeds the workspace root', () => {
    expect(buildSystemPrompt(ctx)).toContain('/abs/workspace');
  });

  it('embeds the absolute handoff file path', () => {
    expect(buildSystemPrompt(ctx)).toContain(
      '/abs/workspace/.nx/agentic/23.0.0/step-1.json'
    );
  });

  it('declares the handoff status values', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('"success"');
    expect(prompt).toContain('"failed"');
  });

  it('mentions the ambiguous outcome when the handoff file is missing', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/ambiguous/i);
  });

  it('warns against changes outside the migration scope', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/refactor|reformat|dependencies/i);
  });
});
