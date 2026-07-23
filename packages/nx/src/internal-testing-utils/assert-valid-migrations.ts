import { MigrationsJson, MigrationsJsonEntry } from '../config/misc-interfaces';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function assertValidMigrationPaths(json: MigrationsJson, root: string) {
  Object.entries(json.generators).forEach(([generator, m]) => {
    it(`should have valid path generator: ${generator}`, () => {
      validateMigration(m, root);
    });
  });

  Object.entries(json.schematics ?? {}).forEach(([schematic, m]) => {
    it(`should have valid path schematic: ${schematic}`, () => {
      validateMigration(m, root);
    });
  });

  it('should contain all folders under ./src/migrations', () => {
    const migrationsPath = path.join(root, 'src/migrations');
    if (!fs.existsSync(migrationsPath)) return;
    const dirs = fs.readdirSync(migrationsPath);
    const knownDirs = new Set<string>(['utils']);
    const migrations = Object.values(json.generators);
    for (const m of migrations) {
      const impl = m.factory ?? m.implementation;
      if (impl) {
        knownDirs.add(path.basename(path.dirname(impl)));
      }
      if (m.prompt) {
        knownDirs.add(path.basename(path.dirname(m.prompt)));
      }
      if (m.documentation) {
        knownDirs.add(path.basename(path.dirname(m.documentation)));
      }
    }
    for (const dir of dirs) {
      expect(knownDirs).toContain(dir);
    }
  });

  it('should not have orphaned migration files under ./src/migrations', () => {
    const migrationsPath = path.join(root, 'src/migrations');
    if (!fs.existsSync(migrationsPath)) return;

    const referenced = new Set<string>();
    const entries = { ...json.generators, ...(json.schematics ?? {}) };
    for (const m of Object.values(entries)) {
      const impl = m.factory ?? m.implementation;
      if (impl) {
        referenced.add(
          normalizeMigrationImplPath(
            toSourcePath(root, impl.split('#')[0], '.ts')
          )
        );
      }
    }

    const orphans = collectMigrationEntryPointFiles(migrationsPath)
      .map((file) => normalizeMigrationImplPath(path.relative(root, file)))
      .filter((rel) => !referenced.has(rel));

    expect(orphans).toEqual([]);
  });

  it('should not have orphaned .md files under ./src/migrations', () => {
    const migrationsPath = path.join(root, 'src/migrations');
    if (!fs.existsSync(migrationsPath)) return;

    const referenced = new Set<string>();
    const entries = { ...json.generators, ...(json.schematics ?? {}) };
    for (const m of Object.values(entries)) {
      if (m.prompt) {
        referenced.add(toMigrationMarkdownSourcePath(m.prompt));
      }
      if (m.documentation) {
        referenced.add(toMigrationMarkdownSourcePath(m.documentation));
      }
    }

    const orphans = collectMarkdownFiles(migrationsPath)
      .map((file) => path.relative(root, file).replace(/\\/g, '/'))
      .filter((rel) => !referenced.has(rel));

    expect(orphans).toEqual([]);
  });
}

function validateMigration(m: MigrationsJsonEntry, root: string) {
  const impl = m.factory ?? m.implementation;
  if (impl) {
    let [implPath, implMember] = impl.includes('#')
      ? impl.split('#')
      : [impl, null];
    implPath = toSourcePath(root, implPath, '.ts');
    let implModule;
    expect(() => {
      implModule = require(path.join(root, `${implPath}.ts`));
    }).not.toThrow();
    if (implMember) {
      expect(implModule).toHaveProperty(implMember);
    }
  }
  if (m.prompt) {
    const promptSourcePath = toSourcePath(root, m.prompt, '');
    expect(fs.existsSync(path.join(root, promptSourcePath))).toBe(true);
  }
  if (m.documentation) {
    const documentationSourcePath = toSourcePath(root, m.documentation, '');
    expect(fs.existsSync(path.join(root, documentationSourcePath))).toBe(true);
  }
}

/**
 * migrations.json carries published paths. The spec runs against the source
 * tree, so map them back: strip `dist/` (`./dist/src/...` -> `src/...`), and
 * for rootDir:"src" packages whose build strips the `src/` segment
 * (`./dist/migrations/...` with sources under `src/migrations/...`),
 * re-prefix `src/` when the direct mapping does not resolve. Unresolvable
 * paths return the direct mapping so the caller's assertion reports it.
 */
function toSourcePath(
  root: string,
  publishedPath: string,
  ext: string
): string {
  const stripped = publishedPath.replace(/^\.?\/?/, '').replace(/^dist\//, '');
  if (fs.existsSync(path.join(root, `${stripped}${ext}`))) {
    return stripped;
  }
  const srcPrefixed = `src/${stripped}`;
  if (fs.existsSync(path.join(root, `${srcPrefixed}${ext}`))) {
    return srcPrefixed;
  }
  return stripped;
}

/**
 * A migration entry point is a top-level `.ts` in a version dir (e.g.
 * `update-22-6-0/foo.ts`) with a default export. Helpers under `utils/`/`lib/`
 * (skipped by name) and anything in a nested subdir (skipped structurally) are
 * excluded. An entry-point file no migrations.json entry references is an
 * orphan: the entry was repointed at another file, or the file outlived its
 * removed entry.
 */
function collectMigrationEntryPointFiles(migrationsPath: string): string[] {
  const files: string[] = [];
  for (const dir of fs.readdirSync(migrationsPath)) {
    if (dir === 'utils' || dir === 'lib') continue;
    const dirPath = path.join(migrationsPath, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const entry of fs.readdirSync(dirPath)) {
      const filePath = path.join(dirPath, entry);
      // Nested dirs (e.g. `lib/`) hold helpers, not entry points.
      if (!fs.statSync(filePath).isFile()) continue;
      if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;
      // Entry points default-export the migration fn; named-only files are helpers.
      if (!/export\s+default/.test(fs.readFileSync(filePath, 'utf-8')))
        continue;
      files.push(filePath);
    }
  }
  return files;
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
  return files;
}

/**
 * Maps a published markdown path from migrations.json back to its source
 * location. Most packages build with rootDir "." and publish
 * `./dist/src/migrations/foo.md`, but packages with rootDir "src" publish
 * `./dist/migrations/foo.md`, so the stripped `src/` segment is added back.
 */
function toMigrationMarkdownSourcePath(publishedPath: string): string {
  const sourcePath = publishedPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^dist\//, '');
  return sourcePath.startsWith('src/') ? sourcePath : `src/${sourcePath}`;
}

function normalizeMigrationImplPath(implPath: string): string {
  return implPath
    .split('#')[0]
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/(^|\/)dist\//, '$1')
    .replace(/\.(t|j)s$/, '');
}
