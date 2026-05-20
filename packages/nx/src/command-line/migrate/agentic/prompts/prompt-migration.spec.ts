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

  it('includes the migration identifier and version inside the migration tag', () => {
    const result = buildPromptMigrationUserPrompt(base);
    expect(result).toMatch(
      /<migration>[\s\S]*package: @nx\/storybook[\s\S]*<\/migration>/
    );
    expect(result).toContain('version: 9.2.0');
    expect(result).toContain('name: migrate-css-imports');
  });

  it('includes the description when provided', () => {
    const result = buildPromptMigrationUserPrompt({
      ...base,
      description: 'Migrate Storybook CSS imports to the new entry-point',
    });
    expect(result).toContain(
      'description: Migrate Storybook CSS imports to the new entry-point'
    );
  });

  it('omits the description line when not provided', () => {
    const result = buildPromptMigrationUserPrompt(base);
    expect(result).not.toContain('description:');
  });

  it('renders a multi-line description as a YAML-style block scalar', () => {
    const result = buildPromptMigrationUserPrompt({
      ...base,
      description: 'Line one\nLine two\nLine three',
    });
    expect(result).toContain('description: |');
    expect(result).toContain('  Line one');
    expect(result).toContain('  Line two');
    expect(result).toContain('  Line three');
  });

  it('embeds the workspace-relative prompt path inside an instructions_file tag', () => {
    expect(buildPromptMigrationUserPrompt(base)).toContain(
      '<instructions_file>tools/ai-migrations/@nx/storybook/9.2.0/migrate-css-imports.md</instructions_file>'
    );
  });

  it('embeds the absolute handoff file path inside a handoff_path tag', () => {
    expect(buildPromptMigrationUserPrompt(base)).toContain(
      '<handoff_path>/abs/workspace/.nx/migrate-runs/23.0.0/migrate-css-imports.json</handoff_path>'
    );
  });
});
