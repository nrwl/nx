import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspacesToPnpmYaml, findWorkspacePackages } from './package-manager';

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
});
