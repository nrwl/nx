import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { prettierVersion } from '../../utils/versions';
import { setupPrettierGenerator } from './generator';

describe('setup-prettier generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // remove the default generated .prettierrc file
    tree.delete('.prettierrc');
  });

  it('should install prettier package', async () => {
    await setupPrettierGenerator(tree, { skipFormat: true });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['prettier']).toBe(prettierVersion);
  });

  it('should create .prettierrc and .prettierignore files', async () => {
    await setupPrettierGenerator(tree, { skipFormat: true });

    const prettierrc = readJson(tree, '.prettierrc');
    expect(prettierrc).toEqual({ singleQuote: true });
    const prettierignore = tree.read('.prettierignore', 'utf-8');
    expect(prettierignore).toMatch(/\n\/coverage/);
    expect(prettierignore).toMatch(/\n\/dist/);
    expect(prettierignore).toMatch(/\n\/\.nx\/cache/);
  });

  it('should not overwrite existing .prettierrc and .prettierignore files', async () => {
    writeJson(tree, '.prettierrc', { singleQuote: false });
    tree.write('.prettierignore', `# custom ignore file`);

    await setupPrettierGenerator(tree, { skipFormat: true });

    const prettierrc = readJson(tree, '.prettierrc');
    expect(prettierrc).toEqual({ singleQuote: false });
    const prettierignore = tree.read('.prettierignore', 'utf-8');
    expect(prettierignore).toContain('# custom ignore file');
  });

  it('should not overwrite prettier configuration specified in other formats', async () => {
    tree.delete('.prettierrc');
    tree.delete('.prettierignore');
    tree.write('.prettierrc.js', `module.exports = { singleQuote: true };`);

    await setupPrettierGenerator(tree, { skipFormat: true });

    expect(tree.exists('.prettierrc')).toBeFalsy();
    expect(tree.exists('.prettierignore')).toBeTruthy();
    expect(tree.read('.prettierrc.js', 'utf-8')).toContain(
      `module.exports = { singleQuote: true };`
    );
  });

  it('should add prettier vscode extension if .vscode/extensions.json file exists', async () => {
    // No existing recommendations
    writeJson(tree, '.vscode/extensions.json', {});

    await setupPrettierGenerator(tree, { skipFormat: true });

    let json = readJson(tree, '.vscode/extensions.json');
    expect(json).toEqual({
      recommendations: ['esbenp.prettier-vscode'],
    });

    // Existing recommendations
    writeJson(tree, '.vscode/extensions.json', { recommendations: ['foo'] });

    await setupPrettierGenerator(tree, { skipFormat: true });

    json = readJson(tree, '.vscode/extensions.json');
    expect(json).toEqual({
      recommendations: ['foo', 'esbenp.prettier-vscode'],
    });
  });

  it('should skip adding prettier extension if .vscode/extensions.json file does not exist', async () => {
    await setupPrettierGenerator(tree, { skipFormat: true });

    expect(tree.exists('.vscode/extensions.json')).toBeFalsy();
  });
});
