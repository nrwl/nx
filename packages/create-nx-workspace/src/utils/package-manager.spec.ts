import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  workspacesToPnpmYaml,
  findWorkspacePackages,
  findAllWorkspacePackageJsons,
  convertStarToWorkspaceProtocol,
} from './package-manager';

describe('workspacesToPnpmYaml', () => {
  it('should convert single workspace glob to yaml', () => {
    expect(workspacesToPnpmYaml(['packages/*'])).toMatchInlineSnapshot(`
      "packages:
        - 'packages/*'
      "
    `);
  });

  it('should convert multiple workspace globs to yaml', () => {
    expect(workspacesToPnpmYaml(['packages/*', 'apps/*']))
      .toMatchInlineSnapshot(`
      "packages:
        - 'packages/*'
        - 'apps/*'
      "
    `);
  });

  it('should handle empty array', () => {
    expect(workspacesToPnpmYaml([])).toMatchInlineSnapshot(`
      "packages:

      "
    `);
  });
});

describe('findWorkspacePackages', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cnw-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should find packages in packages directory', () => {
    mkdirSync(join(tempDir, 'packages', 'pkg-a'), { recursive: true });
    mkdirSync(join(tempDir, 'packages', 'pkg-b'), { recursive: true });
    writeFileSync(
      join(tempDir, 'packages', 'pkg-a', 'package.json'),
      JSON.stringify({ name: '@myorg/pkg-a' })
    );
    writeFileSync(
      join(tempDir, 'packages', 'pkg-b', 'package.json'),
      JSON.stringify({ name: '@myorg/pkg-b' })
    );

    const result = findWorkspacePackages(tempDir);
    expect(result).toEqual(['@myorg/pkg-a', '@myorg/pkg-b']);
  });

  it('should find packages in packages, libs, and apps directories', () => {
    mkdirSync(join(tempDir, 'packages', 'pkg'), { recursive: true });
    mkdirSync(join(tempDir, 'libs', 'lib'), { recursive: true });
    mkdirSync(join(tempDir, 'apps', 'app'), { recursive: true });
    writeFileSync(
      join(tempDir, 'packages', 'pkg', 'package.json'),
      JSON.stringify({ name: '@myorg/pkg' })
    );
    writeFileSync(
      join(tempDir, 'libs', 'lib', 'package.json'),
      JSON.stringify({ name: '@myorg/lib' })
    );
    writeFileSync(
      join(tempDir, 'apps', 'app', 'package.json'),
      JSON.stringify({ name: '@myorg/app' })
    );

    const result = findWorkspacePackages(tempDir);
    expect(result).toEqual(['@myorg/app', '@myorg/lib', '@myorg/pkg']);
  });

  it('should return empty array when no packages found', () => {
    const result = findWorkspacePackages(tempDir);
    expect(result).toEqual([]);
  });

  it('should skip directories without package.json', () => {
    mkdirSync(join(tempDir, 'packages', 'no-pkg'), { recursive: true });
    mkdirSync(join(tempDir, 'packages', 'has-pkg'), { recursive: true });
    writeFileSync(
      join(tempDir, 'packages', 'has-pkg', 'package.json'),
      JSON.stringify({ name: 'has-pkg' })
    );

    const result = findWorkspacePackages(tempDir);
    expect(result).toEqual(['has-pkg']);
  });

  it('should find packages with 2-level nesting', () => {
    // Level 1: libs/utils/package.json
    mkdirSync(join(tempDir, 'libs', 'utils'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'utils', 'package.json'),
      JSON.stringify({ name: '@myorg/utils' })
    );

    // Level 2: libs/shared/models/package.json
    mkdirSync(join(tempDir, 'libs', 'shared', 'models'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'shared', 'models', 'package.json'),
      JSON.stringify({ name: '@myorg/shared-models' })
    );

    // Level 2: libs/shared/ui/package.json
    mkdirSync(join(tempDir, 'libs', 'shared', 'ui'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'shared', 'ui', 'package.json'),
      JSON.stringify({ name: '@myorg/shared-ui' })
    );

    const result = findWorkspacePackages(tempDir);
    expect(result).toEqual([
      '@myorg/shared-models',
      '@myorg/shared-ui',
      '@myorg/utils',
    ]);
  });
});

describe('findAllWorkspacePackageJsons', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cnw-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should find package.json files at both nesting levels', () => {
    // Level 1
    mkdirSync(join(tempDir, 'packages', 'pkg-a'), { recursive: true });
    writeFileSync(
      join(tempDir, 'packages', 'pkg-a', 'package.json'),
      JSON.stringify({ name: 'pkg-a' })
    );

    // Level 2
    mkdirSync(join(tempDir, 'libs', 'shared', 'models'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'shared', 'models', 'package.json'),
      JSON.stringify({ name: 'models' })
    );

    const result = findAllWorkspacePackageJsons(tempDir);
    expect(result).toContain(
      join(tempDir, 'packages', 'pkg-a', 'package.json')
    );
    expect(result).toContain(
      join(tempDir, 'libs', 'shared', 'models', 'package.json')
    );
  });
});

describe('convertStarToWorkspaceProtocol', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cnw-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should convert "*" to "workspace:*" in dependencies', () => {
    mkdirSync(join(tempDir, 'libs', 'utils'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'utils', 'package.json'),
      JSON.stringify({
        name: '@myorg/utils',
        dependencies: {
          '@myorg/shared': '*',
          lodash: '^4.0.0',
        },
      })
    );

    convertStarToWorkspaceProtocol(tempDir);

    const result = JSON.parse(
      readFileSync(join(tempDir, 'libs', 'utils', 'package.json'), 'utf-8')
    );
    expect(result.dependencies['@myorg/shared']).toBe('workspace:*');
    expect(result.dependencies['lodash']).toBe('^4.0.0');
  });

  it('should convert "*" to "workspace:*" in devDependencies', () => {
    mkdirSync(join(tempDir, 'apps', 'web'), { recursive: true });
    writeFileSync(
      join(tempDir, 'apps', 'web', 'package.json'),
      JSON.stringify({
        name: '@myorg/web',
        devDependencies: {
          '@myorg/testing': '*',
          jest: '^29.0.0',
        },
      })
    );

    convertStarToWorkspaceProtocol(tempDir);

    const result = JSON.parse(
      readFileSync(join(tempDir, 'apps', 'web', 'package.json'), 'utf-8')
    );
    expect(result.devDependencies['@myorg/testing']).toBe('workspace:*');
    expect(result.devDependencies['jest']).toBe('^29.0.0');
  });

  it('should handle 2-level nested packages', () => {
    mkdirSync(join(tempDir, 'libs', 'shared', 'models'), { recursive: true });
    writeFileSync(
      join(tempDir, 'libs', 'shared', 'models', 'package.json'),
      JSON.stringify({
        name: '@myorg/shared-models',
        dependencies: {
          '@myorg/utils': '*',
        },
      })
    );

    convertStarToWorkspaceProtocol(tempDir);

    const result = JSON.parse(
      readFileSync(
        join(tempDir, 'libs', 'shared', 'models', 'package.json'),
        'utf-8'
      )
    );
    expect(result.dependencies['@myorg/utils']).toBe('workspace:*');
  });

  it('should not modify package.json without "*" dependencies', () => {
    mkdirSync(join(tempDir, 'packages', 'core'), { recursive: true });
    const originalContent = JSON.stringify(
      {
        name: '@myorg/core',
        dependencies: {
          lodash: '^4.0.0',
        },
      },
      null,
      2
    );
    writeFileSync(
      join(tempDir, 'packages', 'core', 'package.json'),
      originalContent
    );

    convertStarToWorkspaceProtocol(tempDir);

    const result = readFileSync(
      join(tempDir, 'packages', 'core', 'package.json'),
      'utf-8'
    );
    // Should remain unchanged (no trailing newline added)
    expect(result).toBe(originalContent);
  });
});
