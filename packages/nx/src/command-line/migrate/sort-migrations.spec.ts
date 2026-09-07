import { sortMigrations } from './sort-migrations';

const mig = (name: string, version: string) => ({
  package: '@nx/js',
  name,
  version,
});

// Mirrors the composite identity hard-coded in `agentic/types.ts`; a literal
// so a rename there fails here instead of silently changing the sort.
const gitignoreMig = {
  package: 'nx',
  name: '23-0-0-add-migrate-runs-to-git-ignore',
  version: '23.0.0',
};

describe('sortMigrations', () => {
  it('sorts by version ascending, in place, returning the same array', () => {
    const migrations = [mig('b', '16.0.0'), mig('a', '15.0.0')];

    const result = sortMigrations(migrations, { hoistHandoffGitignore: false });

    expect(result).toBe(migrations);
    expect(result.map((m) => m.name)).toEqual(['a', 'b']);
  });

  it('normalizes partial versions before comparing', () => {
    const migrations = [mig('a', '16'), mig('b', '2.0.0')];

    sortMigrations(migrations, { hoistHandoffGitignore: false });

    expect(migrations.map((m) => m.name)).toEqual(['b', 'a']);
  });

  it('hoists the project.json split migration above older migrations', () => {
    const migrations = [
      mig('later', '16.0.0'),
      mig('15-7-0-split-configuration-into-project-json-files', '15.7.0'),
      mig('earlier', '15.0.0'),
    ];

    sortMigrations(migrations, { hoistHandoffGitignore: false });

    expect(migrations.map((m) => m.name)).toEqual([
      '15-7-0-split-configuration-into-project-json-files',
      'earlier',
      'later',
    ]);
  });

  it('hoists the handoff gitignore migration first for agentic runs', () => {
    const migrations = [
      mig('later', '16.0.0'),
      mig('15-7-0-split-configuration-into-project-json-files', '15.7.0'),
      { ...gitignoreMig },
      mig('earlier', '15.0.0'),
    ];

    sortMigrations(migrations, { hoistHandoffGitignore: true });

    expect(migrations.map((m) => m.name)).toEqual([
      '23-0-0-add-migrate-runs-to-git-ignore',
      '15-7-0-split-configuration-into-project-json-files',
      'earlier',
      'later',
    ]);
  });

  it('does not hoist the gitignore migration when the run is not agentic', () => {
    const migrations = [
      { ...gitignoreMig },
      mig('earlier', '15.0.0'),
      mig('later', '16.0.0'),
    ];

    sortMigrations(migrations, { hoistHandoffGitignore: false });

    expect(migrations.map((m) => m.name)).toEqual([
      'earlier',
      'later',
      '23-0-0-add-migrate-runs-to-git-ignore',
    ]);
  });
});
