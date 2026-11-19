import { sortMigrations } from './sort-migrations';

const mig = (name: string, version: string) => ({
  package: '@nx/js',
  name,
  version,
});

describe('sortMigrations', () => {
  it('sorts by version ascending, in place, returning the same array', () => {
    const migrations = [mig('b', '16.0.0'), mig('a', '15.0.0')];

    const result = sortMigrations(migrations);

    expect(result).toBe(migrations);
    expect(result.map((m) => m.name)).toEqual(['a', 'b']);
  });

  it('normalizes partial versions before comparing', () => {
    const migrations = [mig('a', '16'), mig('b', '2.0.0')];

    sortMigrations(migrations);

    expect(migrations.map((m) => m.name)).toEqual(['b', 'a']);
  });

  it('hoists the project.json split migration above older migrations', () => {
    const migrations = [
      mig('later', '16.0.0'),
      mig('15-7-0-split-configuration-into-project-json-files', '15.7.0'),
      mig('earlier', '15.0.0'),
    ];

    sortMigrations(migrations);

    expect(migrations.map((m) => m.name)).toEqual([
      '15-7-0-split-configuration-into-project-json-files',
      'earlier',
      'later',
    ]);
  });
});
