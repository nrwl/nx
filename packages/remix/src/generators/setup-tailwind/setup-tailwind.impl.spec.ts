import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application.impl';
import setupTailwind from './setup-tailwind.impl';

describe('setup-tailwind generator', () => {
  it('should add a tailwind config to an application correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: 'test',
      directory: '.',
      rootProject: true,
    });

    // ACT
    await setupTailwind(tree, { project: 'test' });

    // ASSERT
    expect(tree.exists('tailwind.config.ts')).toBeTruthy();
    expect(tree.read('tailwind.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.exists('postcss.config.js')).toBeTruthy();
    expect(tree.read('postcss.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.exists('app/tailwind.css')).toBeTruthy();
    expect(tree.read('app/tailwind.css', 'utf-8')).toMatchSnapshot();
    expect(tree.read('app/root.tsx', 'utf-8')).toMatchSnapshot();
    expect(
      readJson(tree, 'package.json').dependencies['tailwindcss']
    ).toBeTruthy();
  });
});
