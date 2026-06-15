import 'nx/src/internal-testing-utils/mock-project-graph';

import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addLinterToPlaywrightProject } from './add-linter';

describe('addLinterToPlaywrightProject', () => {
  let tree: Tree;
  let originalUseFlatConfig: string | undefined;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'myapp-e2e', {
      root: 'apps/myapp-e2e',
      sourceRoot: 'apps/myapp-e2e/src',
      projectType: 'application',
    });
    originalUseFlatConfig = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
  });

  afterEach(() => {
    process.env.ESLINT_USE_FLAT_CONFIG = originalUseFlatConfig;
  });

  it('adds the projectService block to an existing flat config when typed linting is requested', async () => {
    // A pre-existing project config means lintProjectGenerator is skipped, so the
    // helper itself must emit the projectService block for typed linting.
    tree.write(
      'apps/myapp-e2e/eslint.config.mjs',
      `export default [{ files: ['**/*.ts'], rules: {} }];\n`
    );

    await addLinterToPlaywrightProject(tree, {
      project: 'myapp-e2e',
      linter: 'eslint',
      enableTypedLinting: true,
      skipPackageJson: true,
      rootProject: false,
      directory: 'e2e',
    });

    const content = tree.read('apps/myapp-e2e/eslint.config.mjs', 'utf-8');
    expect(content).toContain('projectService: true');
    expect(content.match(/projectService: true/g)).toHaveLength(1);
  });

  it('does not add the projectService block when typed linting is not requested', async () => {
    tree.write(
      'apps/myapp-e2e/eslint.config.mjs',
      `export default [{ files: ['**/*.ts'], rules: {} }];\n`
    );

    await addLinterToPlaywrightProject(tree, {
      project: 'myapp-e2e',
      linter: 'eslint',
      skipPackageJson: true,
      rootProject: false,
      directory: 'e2e',
    });

    const content = tree.read('apps/myapp-e2e/eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('projectService');
  });
});
