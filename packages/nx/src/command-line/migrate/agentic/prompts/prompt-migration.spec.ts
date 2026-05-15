import { buildPromptMigrationUserPrompt } from './prompt-migration';

describe('buildPromptMigrationUserPrompt', () => {
  const base = {
    package: '@nx/storybook',
    name: 'migrate-css-imports',
    version: '9.2.0',
    promptPath:
      'tools/ai-migrations/@nx/storybook/9.2.0/migrate-css-imports.md',
    handoffFileAbsolutePath:
      '/abs/workspace/.nx/agentic/23.0.0/migrate-css-imports.json',
  };

  it('includes the migration identifier and version', () => {
    const result = buildPromptMigrationUserPrompt(base);
    expect(result).toContain('@nx/storybook@9.2.0');
    expect(result).toContain('migrate-css-imports');
  });

  it('includes the description when provided', () => {
    const result = buildPromptMigrationUserPrompt({
      ...base,
      description: 'Migrate Storybook CSS imports to the new entry-point',
    });
    expect(result).toContain(
      'Migrate Storybook CSS imports to the new entry-point'
    );
  });

  it('omits the description line when not provided', () => {
    const result = buildPromptMigrationUserPrompt(base);
    expect(result).not.toContain('Description:');
  });

  it('embeds the workspace-relative prompt path', () => {
    expect(buildPromptMigrationUserPrompt(base)).toContain(
      'tools/ai-migrations/@nx/storybook/9.2.0/migrate-css-imports.md'
    );
  });

  it('embeds the absolute handoff file path', () => {
    expect(buildPromptMigrationUserPrompt(base)).toContain(
      '/abs/workspace/.nx/agentic/23.0.0/migrate-css-imports.json'
    );
  });
});
