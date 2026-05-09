import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { removeSync } from 'fs-extra';
import { workspaceRoot } from '@nx/devkit';
import { e2eCwd, getPublishedVersion, runCommand } from '@nx/e2e-utils';

// Packages to verify: source file path (relative to packages/<name>)
// and the expected output path (relative to the repo root)
const packagesToVerify = [
  {
    name: 'nx',
    sourceFile: 'bin/nx.ts',
    outputFile: 'packages/nx/dist/bin/nx.js',
  },
  {
    name: 'devkit',
    sourceFile: 'index.ts',
    outputFile: 'packages/devkit/dist/index.js',
  },
  {
    name: 'js',
    sourceFile: 'src/index.ts',
    outputFile: 'dist/packages/js/src/index.js',
  },
  {
    name: 'react',
    sourceFile: 'index.ts',
    outputFile: 'dist/packages/react/index.js',
  },
  {
    name: 'playwright',
    sourceFile: 'index.ts',
    outputFile: 'dist/packages/playwright/index.js',
  },
  {
    name: 'create-nx-workspace',
    sourceFile: 'index.ts',
    outputFile: 'dist/packages/create-nx-workspace/index.js',
  },
];

describe('Nx Build Verification', () => {
  const repoDir = join(e2eCwd, 'nx-build-repo');

  beforeAll(
    () => {
      // Clone the current nx workspace into the e2e temp directory
      runCommand(`git clone --depth=1 file://${workspaceRoot} ${repoDir}`, {
        cwd: e2eCwd,
      });

      // Update nx package versions in root and workspace-plugin to match
      // what's published in the local registry so pnpm resolves from verdaccio
      const publishedVersion = getPublishedVersion();
      const excludedPackages = [
        '@nx/conformance',
        '@nx/key',
        '@nx/powerpack-license',
        '@nx/graph',
      ];
      for (const pkgJsonPath of [
        join(repoDir, 'package.json'),
        join(repoDir, 'tools/workspace-plugin/package.json'),
      ]) {
        const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
        for (const depsKey of ['dependencies', 'devDependencies']) {
          const deps = pkg[depsKey];
          if (!deps) continue;
          for (const name of Object.keys(deps)) {
            if (
              (name === 'nx' || name.startsWith('@nx/')) &&
              !excludedPackages.includes(name)
            ) {
              deps[name] = publishedVersion;
            }
          }
        }
        writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      }

      // Install dependencies using the published versions from the local registry
      runCommand('pnpm install --no-frozen-lockfile', {
        cwd: repoDir,
      });

      // Build all publishable packages (same as what nx-release builds)
      runCommand('pnpm nx run-many -t build --projects tag:npm:public', {
        cwd: repoDir,
      });
    },
    20 * 60 * 1000
  );

  afterAll(() => {
    if (existsSync(repoDir)) {
      removeSync(repoDir);
    }
  });

  it(
    'should build all packages and produce correct output',
    () => {
      for (const { name, outputFile } of packagesToVerify) {
        const fullOutputPath = join(repoDir, outputFile);
        expect(existsSync(fullOutputPath)).toBe(true);
      }

      // Verify the nx CLI entry point has the shebang
      const nxBin = readFileSync(
        join(repoDir, 'packages/nx/dist/bin/nx.js'),
        'utf-8'
      );
      expect(nxBin).toContain('#!/usr/bin/env node');
    },
    10 * 60 * 1000
  );

  it(
    'should reflect source file changes in build output',
    () => {
      // Save original outputs and inject markers into all source files
      const markers: Record<
        string,
        { marker: string; outputFile: string; originalOutput: string }
      > = {};

      for (const { name, sourceFile, outputFile } of packagesToVerify) {
        const fullSourcePath = join(repoDir, 'packages', name, sourceFile);
        const fullOutputPath = join(repoDir, outputFile);

        const originalOutput = readFileSync(fullOutputPath, 'utf-8');
        const marker = `NX_BUILD_TEST_MARKER_${name}_${Date.now()}`;

        // Append marker to source file
        const originalSource = readFileSync(fullSourcePath, 'utf-8');
        writeFileSync(
          fullSourcePath,
          `${originalSource}\nexport const __build_marker__ = '${marker}';\n`
        );

        markers[name] = { marker, outputFile, originalOutput };
      }

      // Single rebuild of all packages
      runCommand('pnpm nx run-many -t build --projects tag:npm:public', {
        cwd: repoDir,
      });

      // Verify all outputs contain their markers
      for (const { name } of packagesToVerify) {
        const { marker, outputFile, originalOutput } = markers[name];
        const fullOutputPath = join(repoDir, outputFile);
        const updatedOutput = readFileSync(fullOutputPath, 'utf-8');
        expect(updatedOutput).toContain(marker);
        expect(originalOutput).not.toContain(marker);
      }
    },
    10 * 60 * 1000
  );
});
