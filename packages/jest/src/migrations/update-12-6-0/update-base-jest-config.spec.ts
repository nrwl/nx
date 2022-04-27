const mockGetJestProjects = jest.fn(() => []);
jest.mock('../../utils/config/get-jest-projects', () => ({
  getJestProjects: mockGetJestProjects,
}));
const mockResolveConfig = jest.fn(() =>
  Promise.resolve({ singleQuote: true, endOfLine: 'lf' })
);

import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './update-base-jest-config';

describe('update 12.6.0', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'jest.config.js',
      `module.exports = {
            projects: ['<rootDir>/test-1']
        }`
    );
  });

  beforeEach(async () => {
    const prettier = await import('prettier');
    prettier.resolveConfig = mockResolveConfig as any;
  });

  test('no projects key configured', async () => {
    tree.write('jest.config.js', 'module.exports = {}');

    await update(tree);

    const result = tree.read('jest.config.js').toString();
    expect(result).toMatchInlineSnapshot(`
      "const { getJestProjects } = require('@nrwl/jest');

      module.exports = { projects: getJestProjects() };
      "
    `);
  });

  test('all jest projects covered', async () => {
    mockGetJestProjects.mockImplementation(() => ['<rootDir>/test-1']);
    await update(tree);
    const result = tree.read('jest.config.js').toString();
    expect(result).toMatchInlineSnapshot(`
      "const { getJestProjects } = require('@nrwl/jest');

      module.exports = { projects: getJestProjects() };
      "
    `);
  });

  test('some jest projects uncovered', async () => {
    mockGetJestProjects.mockImplementation(() => ['<rootDir>/test-2']);
    await update(tree);
    const result = tree.read('jest.config.js').toString();
    expect(result).toMatchInlineSnapshot(`
      "const { getJestProjects } = require('@nrwl/jest');

      module.exports = { projects: [...getJestProjects(), '<rootDir>/test-1'] };
      "
    `);
  });

  test('proper formatting with multiple uncovered jest projects', async () => {
    mockGetJestProjects.mockImplementation(() => ['<rootDir>/test-2']);
    tree.write(
      'jest.config.js',
      `
module.exports = {
  projects: [
    '<rootDir>/test-1',
    '<rootDir>/test-2',
    '<rootDir>/test-3',
    '<rootDir>/test-4',
    '<rootDir>/test-5'
  ]
}`
    );
    await update(tree);
    const result = tree.read('jest.config.js').toString();
    expect(result).toMatchInlineSnapshot(`
"const { getJestProjects } = require('@nrwl/jest');

module.exports = {
  projects: [
    ...getJestProjects(),
    '<rootDir>/test-1',
    '<rootDir>/test-3',
    '<rootDir>/test-4',
    '<rootDir>/test-5',
  ],
};
"
`);
  });
});
