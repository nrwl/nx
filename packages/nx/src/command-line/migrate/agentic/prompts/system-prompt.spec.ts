import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const ctx = {
    workspaceRoot: '/abs/workspace',
    handoffFileAbsolutePath:
      '/abs/workspace/.nx/migrate-runs/23.0.0/step-1.json',
    packageManager: 'npm',
  };

  it('embeds the workspace root inside its tag', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<workspace_root>/abs/workspace</workspace_root>');
  });

  it('renders the handoff path on its own line between the tags', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain(
      '   <handoff_path>\n   /abs/workspace/.nx/migrate-runs/23.0.0/step-1.json\n   </handoff_path>'
    );
  });

  it('emits the package manager block and pins the agent to it', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<package_manager>npm</package_manager>');
    expect(prompt).toMatch(/Use `npm` for any package-manager invocation/);
  });

  it('wraps the handoff contract, environment note, and scope rules in their tags', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<handoff_contract>');
    expect(prompt).toContain('</handoff_contract>');
    expect(prompt).toContain('<environment_note>');
    expect(prompt).toContain('</environment_note>');
    expect(prompt).toContain('<scope_rules>');
    expect(prompt).toContain('</scope_rules>');
  });

  it('instructs the agent to summarize for the user, write the handoff, and tells it nx closes the session', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toMatch(/1\. Tell the user briefly what you did/);
    expect(prompt).toMatch(
      /Mention that writing the handoff file will close this session/
    );
    expect(prompt).toMatch(/2\. Write a JSON file at:/);
    expect(prompt).toMatch(/3\. You're done\./);
    expect(prompt).toMatch(/nx closes this session automatically/);
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
