import { writeJson, readJson, Tree, updateJson, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import init from './init';
import { typescriptVersion } from '../../utils/versions';

describe('js init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Remove files that should be part of the init generator
    tree.delete('tsconfig.base.json');
    tree.delete('.prettierrc');
  });

  it('should install prettier package', async () => {
    await init(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['prettier']).toBeDefined();
  });

  it('should create .prettierrc and .prettierignore files', async () => {
    await init(tree, {});

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

    await init(tree, {});

    const prettierrc = readJson(tree, '.prettierrc');
    expect(prettierrc).toEqual({ singleQuote: false });

    const prettierignore = tree.read('.prettierignore', 'utf-8');
    expect(prettierignore).toContain('# custom ignore file');
  });

  it('should not overwrite prettier configuration specified in other formats', async () => {
    tree.delete('.prettierrc');
    tree.delete('.prettierignore');
    tree.write('.prettierrc.js', `module.exports = { singleQuote: true };`);

    await init(tree, {});

    expect(tree.exists('.prettierrc')).toBeFalsy();
    expect(tree.exists('.prettierignore')).toBeTruthy();
    expect(tree.read('.prettierrc.js', 'utf-8')).toContain(
      `module.exports = { singleQuote: true };`
    );
  });

  it('should add prettier vscode extension if .vscode/extensions.json file exists', async () => {
    // No existing recommendations
    writeJson(tree, '.vscode/extensions.json', {});

    await init(tree, {});

    let json = readJson(tree, '.vscode/extensions.json');
    expect(json).toEqual({
      recommendations: ['esbenp.prettier-vscode'],
    });

    // Existing recommendations
    writeJson(tree, '.vscode/extensions.json', { recommendations: ['foo'] });

    await init(tree, {});

    json = readJson(tree, '.vscode/extensions.json');
    expect(json).toEqual({
      recommendations: ['foo', 'esbenp.prettier-vscode'],
    });
  });

  it('should skip adding prettier extension if .vscode/extensions.json file does not exist', async () => {
    await init(tree, {});

    expect(tree.exists('.vscode/extensions.json')).toBeFalsy();
  });

  it('should install typescript package when it is not already installed', async () => {
    await init(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['typescript']).toBeDefined();
  });

  it('should overwrite installed typescript version when is not a supported version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, typescript: '~4.5.0' };
      return json;
    });

    await init(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['typescript']).toBe(typescriptVersion);
  });

  it('should not overwrite installed typescript version when is a supported version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, typescript: '~5.2.0' };
      return json;
    });

    await init(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['typescript']).toBe('~5.2.0');
    expect(packageJson.devDependencies['typescript']).not.toBe(
      typescriptVersion
    );
  });

  it('should support skipping base tsconfig file', async () => {
    await init(tree, {
      addTsConfigBase: false,
    });

    expect(tree.exists('tsconfig.base.json')).toBeFalsy();
  });

  it('should support skipping prettier setup', async () => {
    await init(tree, {
      formatter: 'none',
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['prettier']).toBeUndefined();
    expect(tree.exists('.prettierignore')).toBeFalsy();
    expect(tree.exists('.prettierrc')).toBeFalsy();
  });

  it.each`
    fileName                | importHelpers | shouldAdd
    ${'tsconfig.json'}      | ${true}       | ${true}
    ${'tsconfig.base.json'} | ${true}       | ${true}
    ${'tsconfig.json'}      | ${false}      | ${false}
    ${'tsconfig.base.json'} | ${false}      | ${false}
    ${null}                 | ${false}      | ${false}
  `(
    'should add tslib if importHelpers is true in base tsconfig',
    async ({ fileName, importHelpers, shouldAdd }) => {
      if (fileName) {
        writeJson(tree, fileName, {
          compilerOptions: {
            importHelpers,
          },
        });
      }

      await init(tree, {
        addTsConfigBase: false,
      });

      const packageJson = readJson(tree, 'package.json');
      expect(!!packageJson.devDependencies?.['tslib']).toBe(shouldAdd);
    }
  );

  it('should register the @nx/js/typescript plugin when addTsPlugin is true', async () => {
    await init(tree, { addTsPlugin: true });

    const nxJson = readNxJson(tree);
    const typescriptPlugin = nxJson.plugins.find(
      (plugin) =>
        typeof plugin === 'object' && plugin.plugin === '@nx/js/typescript'
    );
    expect(typescriptPlugin).toBeDefined();
  });

  it('should create tsconfig.json and tsconfig.base.json files when addTsPlugin is true', async () => {
    await init(tree, { addTsPlugin: true });

    expect(tree.read('tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "extends": "./tsconfig.base.json",
        "compileOnSave": false,
        "files": [],
        "references": []
      }
      "
    `);
    expect(tree.read('tsconfig.base.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "compilerOptions": {
          "composite": true,
          "declarationMap": true,
          "emitDeclarationOnly": true,
          "importHelpers": true,
          "isolatedModules": true,
          "lib": ["es2022"],
          "module": "nodenext",
          "moduleResolution": "nodenext",
          "noEmitOnError": true,
          "noFallthroughCasesInSwitch": true,
          "noImplicitOverride": true,
          "noImplicitReturns": true,
          "noUnusedLocals": true,
          "skipLibCheck": true,
          "strict": true,
          "target": "es2022",
          "customConditions": ["development"]
        }
      }
      "
    `);
  });

  it.each`
    platform  | module        | moduleResolution
    ${'web'}  | ${'esnext'}   | ${'bundler'}
    ${'node'} | ${'nodenext'} | ${'nodenext'}
  `(
    'should set module: $module and moduleResolution: $moduleResolution in tsconfig.base.json for platform: $platform',
    async ({ platform, module, moduleResolution }) => {
      await init(tree, { addTsPlugin: true, platform });

      const tsconfigBaseJson = readJson(tree, 'tsconfig.base.json');
      expect(tsconfigBaseJson.compilerOptions.module).toBe(module);
      expect(tsconfigBaseJson.compilerOptions.moduleResolution).toBe(
        moduleResolution
      );
    }
  );
});
