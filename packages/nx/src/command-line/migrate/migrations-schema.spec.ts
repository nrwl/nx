import Ajv from 'ajv';
import * as migrationsSchema from '../../../schemas/migrations-schema.json';
import * as nxMigrations from '../../../migrations.json';

describe('migrations-schema.json', () => {
  const ajv = new Ajv();
  const validate = ajv.compile(migrationsSchema);

  it('compiles as a valid JSON schema', () => {
    expect(typeof validate).toBe('function');
  });

  it('accepts a representative migrations.json', () => {
    const migrations = {
      $schema: '../../node_modules/nx/schemas/migrations-schema.json',
      version: '1.0.0',
      generators: {
        'update-foo': {
          version: '1.2.0',
          description: 'Updates foo',
          implementation: './src/migrations/update-foo/update-foo',
        },
        'prompt-migration': {
          version: '1.3.0',
          description: 'Agent-driven change',
          prompt: './src/migrations/prompt-migration/prompt.md',
        },
      },
      packageJsonUpdates: {
        '1.2.0': {
          version: '1.2.0',
          'x-prompt': 'Update dependencies?',
          packages: {
            'some-dep': { version: '^2.0.0', alwaysAddToPackageJson: false },
          },
        },
      },
    };

    expect(validate(migrations)).toBe(true);
  });

  it('rejects a migration missing its version', () => {
    expect(validate({ generators: { bad: { implementation: './x' } } })).toBe(
      false
    );
  });

  it('rejects a migration without an implementation, factory, or prompt', () => {
    expect(validate({ generators: { bad: { version: '1.0.0' } } })).toBe(false);
  });

  it('rejects a packageJsonUpdate missing its packages', () => {
    expect(
      validate({ packageJsonUpdates: { '1.0.0': { version: '1.0.0' } } })
    ).toBe(false);
  });

  it("accepts the nx package's own migrations.json", () => {
    expect(validate(nxMigrations)).toBe(true);
  });
});
