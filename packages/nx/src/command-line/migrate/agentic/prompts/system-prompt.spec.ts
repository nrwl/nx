import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const ctx = {
    workspaceRoot: '/abs/workspace',
    handoffFileAbsolutePath:
      '/abs/workspace/.nx/migrate-runs/23.0.0/step-1.json',
  };

  it('embeds the workspace root and handoff path inside their tags', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<workspace_root>/abs/workspace</workspace_root>');
    expect(prompt).toContain(
      '<handoff_path>/abs/workspace/.nx/migrate-runs/23.0.0/step-1.json</handoff_path>'
    );
  });

  it('wraps the handoff contract and scope rules in their tags', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<handoff_contract>');
    expect(prompt).toContain('</handoff_contract>');
    expect(prompt).toContain('<scope_rules>');
    expect(prompt).toContain('</scope_rules>');
  });

  describe('scope rules selection', () => {
    const AUTHOR_MARKER =
      'Apply only the changes the migration prompt asks for.';
    const VALIDATION_MARKER = /validate the generator's changes/i;

    it('emits the author scope rules by default', () => {
      expect(buildSystemPrompt(ctx)).toContain(AUTHOR_MARKER);
      expect(buildSystemPrompt(ctx)).not.toMatch(VALIDATION_MARKER);
    });

    it('emits the author scope rules when mode is set to "author" explicitly', () => {
      expect(buildSystemPrompt({ ...ctx, mode: 'author' })).toContain(
        AUTHOR_MARKER
      );
    });

    it('emits the generic-validation scope rules and omits the author marker when mode is "generic-validation"', () => {
      const prompt = buildSystemPrompt({ ...ctx, mode: 'generic-validation' });
      expect(prompt).toMatch(VALIDATION_MARKER);
      expect(prompt).not.toContain(AUTHOR_MARKER);
    });
  });
});
