import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { validateGeneratorTemplateAssets } from './index';
import type { BuildLayout } from '../utils/copied-assets';

describe('generator-template-assets', () => {
  let rootDir: string;
  const projectRoot = 'packages/acme';
  const flatLayout: BuildLayout = { sourceDir: 'src', outDir: 'dist' };
  const nestedLayout: BuildLayout = { sourceDir: '.', outDir: 'dist' };

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'generator-template-assets-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function writeFile(path: string, content = 'template') {
    const file = join(rootDir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  function validate(assets: any[], buildLayout: BuildLayout = flatLayout) {
    return validateGeneratorTemplateAssets({
      assetsJson: { outDir: `${projectRoot}/dist`, assets },
      buildLayout,
      projectRoot,
      sourceProject: 'acme',
      assetsPath: join(rootDir, projectRoot, 'assets.json'),
      rootDir,
    });
  }

  it('should return no violations when an asset glob copies the templates into the build output', () => {
    writeFile('packages/acme/src/generators/app/files/src/index.ts.template');

    expect(
      validate([{ glob: '**/files/**', input: 'packages/acme/src' }])
    ).toEqual([]);
  });

  it('should return a violation when no asset glob copies the templates', () => {
    writeFile('packages/acme/src/generators/app/files/src/index.ts.template');

    const violations = validate([{ glob: 'src/**/schema.json' }]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain(
      'src/generators/app/files/src/index.ts.template'
    );
    expect(violations[0].sourceProject).toBe('acme');
  });

  // A glob whose input is the package root mirrors `src/` into the output, so
  // under this layout the templates land a directory below where the compiled
  // generator looks for them.
  it('should return a violation when the glob copies the templates beside the build output rather than into it', () => {
    writeFile('packages/acme/src/generators/app/files/src/index.ts.template');

    const violations = validate([{ glob: '**/files/**' }]);

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain(
      'packages/acme/dist/generators/app/files/src/index.ts.template'
    );
  });

  it('should accept a package-root glob when the package compiles from its own root', () => {
    writeFile('packages/acme/src/generators/app/files/src/index.ts.template');

    expect(validate([{ glob: '**/files/**' }], nestedLayout)).toEqual([]);
  });

  it('should return a violation when the glob copies the templates elsewhere in the build output', () => {
    writeFile('packages/acme/src/generators/app/files/src/index.ts.template');

    expect(
      validate([
        {
          glob: '**/files/**',
          input: 'packages/acme/src',
          output: '/templates',
        },
      ])
    ).toHaveLength(1);
  });

  // The ci-workflow generators template whole dot directories, and a glob that
  // does not opt into dotfiles skips every one of them.
  it('should check templates nested under a dot directory', () => {
    writeFile(
      'packages/acme/src/generators/ci-workflow/files/github/.github/workflows/ci.yml.template'
    );

    expect(validate([{ glob: 'src/**/schema.json' }])).toHaveLength(1);
    expect(
      validate([{ glob: '**/files/**', input: 'packages/acme/src' }])
    ).toEqual([]);
  });

  it('should check suffixed template directories', () => {
    writeFile(
      'packages/acme/src/generators/app/files-angular/src/app.ts.template'
    );

    expect(
      validate([{ glob: '**/files/**', input: 'packages/acme/src' }])
    ).toHaveLength(1);
    expect(
      validate([
        { glob: '**/@(files|files-angular)/**', input: 'packages/acme/src' },
      ])
    ).toEqual([]);
  });

  // A package that compiles from its own root has its build output and its
  // installed dependencies inside the walked tree. Templates the build already
  // copied are not sources, and a dependency's templates are not this package's.
  it('should ignore templates inside the build output', () => {
    writeFile('packages/acme/src/generators/app/files/index.ts.template');
    writeFile('packages/acme/dist/src/generators/app/files/index.ts.template');

    expect(validate([{ glob: '**/files/**' }], nestedLayout)).toEqual([]);
  });

  it('should ignore templates inside node_modules', () => {
    writeFile(
      'packages/acme/node_modules/dep/src/generators/x/files/a.template'
    );

    expect(validate([{ glob: '**/files/**' }], nestedLayout)).toEqual([]);
  });

  it('should return no violations when the package has no template directories', () => {
    writeFile('packages/acme/src/generators/app/generator.ts', 'export {};');

    expect(validate([{ glob: 'src/**/schema.json' }])).toEqual([]);
  });
});
