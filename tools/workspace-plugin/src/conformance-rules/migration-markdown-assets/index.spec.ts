import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { validateMigrationMarkdownAssets } from './index';

describe('migration-markdown-assets', () => {
  let rootDir: string;
  const projectRoot = 'packages/acme';

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'migration-markdown-assets-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function writeFile(path: string, content = '# Doc') {
    const file = join(rootDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function validate(migrations: Record<string, any>, assets: any[]) {
    return validateMigrationMarkdownAssets({
      migrations,
      assetsJson: { outDir: `${projectRoot}/dist`, assets },
      projectRoot,
      sourceProject: 'acme',
      migrationsPath: join(rootDir, projectRoot, 'migrations.json'),
      rootDir,
    });
  }

  const migrationWith = (key: string, value: string) => ({
    generators: {
      'update-1-0-0': {
        version: '1.0.0',
        implementation: './dist/src/migrations/update-1-0-0/migration',
        [key]: value,
      },
    },
  });

  it.each(['documentation', 'prompt'])(
    'should return no violations when an asset glob copies the %s file into dist',
    (key) => {
      writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

      const violations = validate(
        migrationWith(key, './dist/src/migrations/update-1-0-0/doc.md'),
        [{ glob: 'src/migrations/**/*.md' }]
      );

      expect(violations).toEqual([]);
    }
  );

  it.each(['documentation', 'prompt'])(
    'should return a violation when no asset glob copies the %s file into dist',
    (key) => {
      writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

      const violations = validate(
        migrationWith(key, './dist/src/migrations/update-1-0-0/doc.md'),
        [{ glob: 'src/**/schema.json' }]
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain(
        './dist/src/migrations/update-1-0-0/doc.md'
      );
      expect(violations[0].sourceProject).toBe('acme');
    }
  );

  it('should return a violation when the glob matches but copies the file elsewhere in dist', () => {
    writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

    const violations = validate(
      migrationWith(
        'documentation',
        './dist/src/migrations/update-1-0-0/doc.md'
      ),
      [{ glob: 'src/migrations/**/*.md', output: '/docs' }]
    );

    expect(violations).toHaveLength(1);
  });

  it('should return no violations when a string asset copies the file into dist', () => {
    writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

    const violations = validate(
      migrationWith(
        'documentation',
        './dist/src/migrations/update-1-0-0/doc.md'
      ),
      ['packages/acme/src/migrations/**/*.md']
    );

    expect(violations).toEqual([]);
  });

  it('should resolve globs against an input directory', () => {
    writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

    const violations = validate(
      migrationWith('documentation', './dist/migrations/update-1-0-0/doc.md'),
      [{ glob: 'migrations/**/*.md', input: 'packages/acme/src' }]
    );

    expect(violations).toEqual([]);
  });

  it('should ignore references that point outside dist', () => {
    writeFile('packages/acme/migrations/update-1-0-0/doc.md');

    const violations = validate(
      migrationWith('documentation', './migrations/update-1-0-0/doc.md'),
      [{ glob: 'src/**/schema.json' }]
    );

    expect(violations).toEqual([]);
  });

  it('should return no violations when no migration references markdown', () => {
    const violations = validate(
      {
        generators: {
          'update-1-0-0': {
            version: '1.0.0',
            implementation: './dist/src/migrations/update-1-0-0/migration',
          },
        },
      },
      [{ glob: 'src/**/schema.json' }]
    );

    expect(violations).toEqual([]);
  });
});
