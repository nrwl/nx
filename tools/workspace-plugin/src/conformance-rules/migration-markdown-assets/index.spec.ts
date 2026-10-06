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

  it('should return a violation when a reference points outside dist', () => {
    writeFile('packages/acme/src/migrations/update-1-0-0/doc.md');

    const violations = validate(
      migrationWith('documentation', './src/migrations/update-1-0-0/doc.md'),
      [{ glob: 'src/migrations/**/*.md' }]
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('resolves outside');
  });

  it('should check the generators entry when schematics declares the same name', () => {
    writeFile('packages/acme/src/migrations/update-1-0-0/from-generators.md');

    const violations = validate(
      {
        schematics: {
          'update-1-0-0': {
            version: '1.0.0',
            documentation: './dist/src/migrations/update-1-0-0/uncopied.md',
          },
        },
        generators: {
          'update-1-0-0': {
            version: '1.0.0',
            documentation:
              './dist/src/migrations/update-1-0-0/from-generators.md',
          },
        },
      },
      [{ glob: 'src/migrations/**/*.md' }]
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

  describe('implementation paths', () => {
    function writeTsconfig(
      compilerOptions: { rootDir: string; outDir: string },
      name = 'tsconfig.lib.json'
    ) {
      writeFile(`${projectRoot}/${name}`, JSON.stringify({ compilerOptions }));
    }

    function validateImplementation(implementation: Record<string, string>) {
      return validate(
        {
          generators: {
            'update-1-0-0': { version: '1.0.0', ...implementation },
          },
        },
        [{ glob: 'src/**/schema.json' }]
      );
    }

    it('should return no violations when the implementation maps to an existing source file', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' });
      writeFile(`${projectRoot}/src/migrations/update-1-0-0/migration.ts`);

      const violations = validateImplementation({
        implementation: './dist/src/migrations/update-1-0-0/migration',
      });

      expect(violations).toEqual([]);
    });

    it('should return a violation when the implementation points outside the build output', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' });
      writeFile(`${projectRoot}/src/migrations/update-1-0-0/migration.ts`);

      const violations = validateImplementation({
        implementation: './src/migrations/update-1-0-0/migration',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain(
        'resolves outside the build output'
      );
    });

    it('should return a violation when the source file the implementation maps to is missing', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' });

      const violations = validateImplementation({
        implementation: './dist/src/migrations/update-1-0-0/migration',
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain(
        'packages/acme/src/migrations/update-1-0-0/migration.ts'
      );
    });

    it('should check a `factory` entry the same way as an `implementation` one', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' });

      const violations = validateImplementation({
        factory: './dist/src/migrations/update-1-0-0/migration',
      });

      expect(violations).toHaveLength(1);
    });

    it('should ignore a `#member` suffix when resolving the source file', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' });
      writeFile(`${projectRoot}/src/migrations/update-1-0-0/migration.ts`);

      const violations = validateImplementation({
        implementation: './dist/src/migrations/update-1-0-0/migration#update',
      });

      expect(violations).toEqual([]);
    });

    it('should map the implementation through a rootDir of "src"', () => {
      writeTsconfig({ rootDir: 'src', outDir: 'dist' });
      writeFile(`${projectRoot}/src/migrations/update-1-0-0/migration.ts`);

      const violations = validateImplementation({
        implementation: './dist/migrations/update-1-0-0/migration',
      });

      expect(violations).toEqual([]);
    });

    it('should fall back to tsconfig.json when tsconfig.lib.json is absent', () => {
      writeTsconfig({ rootDir: '.', outDir: 'dist' }, 'tsconfig.json');

      const violations = validateImplementation({
        implementation: './dist/src/migrations/update-1-0-0/migration',
      });

      expect(violations).toHaveLength(1);
    });
  });
});
