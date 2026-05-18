import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const ctx = {
    workspaceRoot: '/abs/workspace',
    handoffFileAbsolutePath: '/abs/workspace/.nx/agentic/23.0.0/step-1.json',
  };

  it('embeds the workspace root inside a workspace_root tag', () => {
    expect(buildSystemPrompt(ctx)).toContain(
      '<workspace_root>/abs/workspace</workspace_root>'
    );
  });

  it('embeds the absolute handoff file path inside a handoff_path tag', () => {
    expect(buildSystemPrompt(ctx)).toContain(
      '<handoff_path>/abs/workspace/.nx/agentic/23.0.0/step-1.json</handoff_path>'
    );
  });

  it('wraps the handoff contract in a handoff_contract tag', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<handoff_contract>');
    expect(prompt).toContain('</handoff_contract>');
  });

  it('declares the handoff status values', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('"success"');
    expect(prompt).toContain('"failed"');
  });

  it('mentions the ambiguous outcome when the handoff file is missing', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/ambiguous/i);
  });

  it('states that extra handoff fields are ignored', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/extra fields .*ignored/i);
  });

  it('wraps the scope rules in a scope_rules tag', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<scope_rules>');
    expect(prompt).toContain('</scope_rules>');
  });

  it('warns against changes outside the migration scope', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/refactor|reformat|dependencies/i);
  });

  it('forbids running other mutating nx commands', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/nx (migrate|reset|run-many)/);
  });

  it('tells the agent to fail rather than guess on unclear instructions', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/unclear/i);
    expect(buildSystemPrompt(ctx)).toMatch(/do not guess/i);
  });
});
