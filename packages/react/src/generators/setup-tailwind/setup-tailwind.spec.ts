import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  stripIndents,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './setup-tailwind';

describe('setup-tailwind', () => {
  it.each`
    stylesPath
    ${`src/styles.css`}
    ${`src/styles.scss`}
    ${`src/styles.less`}
    ${`src/styles.styl`}
    ${`pages/styles.css`}
    ${`pages/styles.scss`}
    ${`pages/styles.less`}
    ${`pages/styles.styl`}
  `('should update stylesheet', async ({ stylesPath }) => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {},
    });
    tree.write(`apps/example/${stylesPath}`, `/* existing content */`);

    await update(tree, {
      project: 'example',
    });

    expect(tree.read(`apps/example/${stylesPath}`).toString()).toContain(
      stripIndents`
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        /* existing content */
      `
    );
  });

  it('should add postcss and tailwind config files', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          options: {},
        },
      },
    });
    tree.write(`apps/example/src/styles.css`, ``);
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '999.9.9',
      },
      devDependencies: {
        '@types/react': '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
    });

    expect(tree.exists(`apps/example/postcss.config.js`)).toBeTruthy();
    expect(tree.exists(`apps/example/tailwind.config.js`)).toBeTruthy();
    expect(
      readProjectConfiguration(tree, 'example').targets.build.options
        .postcssConfig
    ).toEqual('apps/example/postcss.config.js');
  });

  it('should skip update if postcss configuration already exists', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {},
    });
    tree.write(`apps/example/src/styles.css`, ``);
    tree.write('apps/example/postcss.config.js', '// existing');

    await update(tree, { project: 'example' });

    expect(tree.read('apps/example/postcss.config.js').toString()).toEqual(
      '// existing'
    );
  });

  it('should skip update if tailwind configuration already exists', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {},
    });
    tree.write(`apps/example/src/styles.css`, ``);
    tree.write('apps/example/tailwind.config.js', '// existing');

    await update(tree, { project: 'example' });

    expect(tree.read('apps/example/tailwind.config.js').toString()).toEqual(
      '// existing'
    );
  });

  it('should install packages', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {},
    });
    tree.write(`apps/example/src/styles.css`, ``);
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '999.9.9',
      },
      devDependencies: {
        '@types/react': '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        react: '999.9.9',
      },
      devDependencies: {
        '@types/react': '999.9.9',
        autoprefixer: expect.any(String),
        postcss: expect.any(String),
        tailwindcss: expect.any(String),
      },
    });
  });

  it('should support skipping package install', async () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'example', {
      root: 'apps/example',
      sourceRoot: 'apps/example/src',
      targets: {},
    });
    tree.write(`apps/example/src/styles.css`, ``);
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '999.9.9',
      },
      devDependencies: {
        '@types/react': '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
      skipPackageJson: true,
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        react: '999.9.9',
      },
      devDependencies: {
        '@types/react': '999.9.9',
      },
    });
  });
});
