import { buildPromptMigrationUserPrompt } from './prompt-migration';

describe('buildPromptMigrationUserPrompt', () => {
  const base = {
    package: '@nx/storybook',
    name: 'migrate-css-imports',
    version: '9.2.0',
    promptPath:
      'tools/ai-migrations/@nx/storybook/9.2.0/migrate-css-imports.md',
    handoffFileAbsolutePath:
      '/abs/workspace/.nx/migrate-runs/23.0.0/migrate-css-imports.json',
  };

  it('embeds the migration identifier inside <migration> and the paths inside their tags', () => {
    const result = buildPromptMigrationUserPrompt({
      ...base,
      description: 'Migrate Storybook CSS imports to the new entry-point',
    });
    expect(result).toMatch(
      /<migration>[\s\S]*package: @nx\/storybook[\s\S]*<\/migration>/
    );
    expect(result).toContain('version: 9.2.0');
    expect(result).toContain('name: migrate-css-imports');
    expect(result).toContain(
      'description: Migrate Storybook CSS imports to the new entry-point'
    );
    expect(result).toContain(
      `<instructions_file>${base.promptPath}</instructions_file>`
    );
    expect(result).toContain(
      `<handoff_path>\n${base.handoffFileAbsolutePath}\n</handoff_path>`
    );
  });

  it('omits the description line when not provided', () => {
    expect(buildPromptMigrationUserPrompt(base)).not.toContain('description:');
  });
});
