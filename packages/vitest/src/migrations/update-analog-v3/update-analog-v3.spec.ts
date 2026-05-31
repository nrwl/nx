import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, Tree } from '@nx/devkit';
import updateAnalogV3 from './update-analog-v3';

describe('update-analog-v3 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update @analogjs/vitest-angular to ~3.0.0', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@analogjs/vitest-angular': '~2.1.2',
          '@analogjs/vite-plugin-angular': '~2.1.2',
        },
      })
    );

    await updateAnalogV3(tree);

    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['@analogjs/vitest-angular']).toBe('~3.0.0');
    expect(pkgJson.devDependencies['@analogjs/vite-plugin-angular']).toBe(
      '~3.0.0'
    );
  });

  it('should not modify package.json if analog is not installed', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          vitest: '^4.0.0',
        },
      })
    );

    await updateAnalogV3(tree);

    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.devDependencies['@analogjs/vitest-angular']).toBeUndefined();
  });

  it('should replace deprecated setup-vitest import in config files', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@analogjs/vitest-angular': '~2.1.2',
        },
      })
    );
    tree.write(
      'apps/my-app/vite.config.ts',
      `import '@analogjs/vite-plugin-angular/setup-vitest';\nexport default {};\n`
    );

    await updateAnalogV3(tree);

    const content = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(content).toContain('@analogjs/vitest-angular');
    expect(content).not.toContain('@analogjs/vite-plugin-angular/setup-vitest');
  });

  it('should replace deprecated import in test-setup.ts', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@analogjs/vitest-angular': '~2.1.2',
        },
      })
    );
    tree.write(
      'libs/my-lib/src/test-setup.ts',
      [
        `import '@analogjs/vite-plugin-angular/setup-vitest';`,
        `import { TestBed } from '@angular/core/testing';`,
        '',
      ].join('\n')
    );

    await updateAnalogV3(tree);

    const content = tree.read('libs/my-lib/src/test-setup.ts', 'utf-8');
    expect(content).toContain("import '@analogjs/vitest-angular'");
    expect(content).not.toContain('setup-vitest');
    expect(content).toContain('TestBed');
  });

  it('should not modify files that do not contain deprecated imports', async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@analogjs/vitest-angular': '~2.1.2',
        },
      })
    );
    const original = `import '@analogjs/vitest-angular/setup-snapshots';\n`;
    tree.write('apps/my-app/src/test-setup.ts', original);

    await updateAnalogV3(tree);

    const content = tree.read('apps/my-app/src/test-setup.ts', 'utf-8');
    expect(content).toBe(original);
  });
});
