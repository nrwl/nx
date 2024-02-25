import {
  addProjectConfiguration,
  readJson,
  stripIndents,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './setup-tailwind';

describe('vue setup-tailwind generator', () => {
  it.each`
    stylesPath
    ${`src/styles.css`}
    ${`src/styles.scss`}
    ${`src/styles.less`}
    ${`src/assets/styles.css`}
    ${`src/assets/styles.scss`}
    ${`src/assets/styles.less`}
    ${`src/assets/css/styles.css`}
    ${`src/assets/css/styles.scss`}
    ${`src/assets/css/styles.less`}
  `('should update existing stylesheet', async ({ stylesPath }) => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    tree.write(`example/${stylesPath}`, `/* existing content */`);

    await update(tree, {
      project: 'example',
    });

    expect(tree.read(`example/${stylesPath}`).toString()).toContain(
      stripIndents`
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        /* existing content */
      `
    );
  });

  it('should update existing stylesheet passed with option', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    tree.write(`example/src/style.css`, `/* existing content */`);

    await update(tree, {
      project: 'example',
      stylesheet: 'src/style.css',
    });

    expect(tree.read(`example/src/style.css`).toString()).toContain(
      stripIndents`
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        /* existing content */
      `
    );
  });

  it('should install packages', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    tree.write(`example/src/styles.css`, ``);
    writeJson(tree, 'package.json', {
      dependencies: {
        vue: '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        vue: '999.9.9',
      },
      devDependencies: {
        autoprefixer: expect.any(String),
        postcss: expect.any(String),
        tailwindcss: expect.any(String),
      },
    });
  });

  it('should support skipping package install', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    tree.write(`example/src/styles.css`, ``);
    writeJson(tree, 'package.json', {
      dependencies: {
        vue: '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
      skipPackageJson: true,
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        vue: '999.9.9',
      },
    });
  });
});
