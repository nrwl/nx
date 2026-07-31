import { writeJson, readJson, Tree, updateJson, readNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import init from './init';
import {
  oxfmtVersion,
  prettierVersion,
  typescriptVersion,
} from '../../utils/versions';

// `ensurePackage` performs a real out-of-band install, so the only way to
// assert *whether* it runs is to intercept it.
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  ensurePackage: jest.fn(),
}));
const { ensurePackage } = jest.requireMock('@nx/devkit');

describe('js init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    // No formatter: this suite is about which one init picks and sets up, so a
    // pre-seeded config would answer the question before the generator runs.
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    // Remove files that should be part of the init generator
    tree.delete('tsconfig.base.json');
    (ensurePackage as jest.Mock).mockClear();
  });

  describe('making the formatter resolvable before it formats', () => {
    // The install task is queued, not run, so without this the formatter the
    // generator just added is still missing when formatFiles tries to load it.

    // The version is asserted exactly, not as `expect.any(String)`: pairing each
    // formatter with its own version is the reason the setup table exists, and a
    // swapped pair would only surface as a failed install for users.
    it.each([
      ['oxfmt', oxfmtVersion],
      ['prettier', prettierVersion],
    ] as const)(
      'should ensure %s is installed before formatting',
      async (formatter, version) => {
        await init(tree, { formatter });

        expect(ensurePackage).toHaveBeenCalledWith(formatter, version);
      }
    );

    it('should not install anything when skipPackageJson is set', async () => {
      // That option asks this generator not to manage dependencies, and an
      // out-of-band install is still an install.
      await init(tree, { formatter: 'oxfmt', skipPackageJson: true });

      expect(ensurePackage).not.toHaveBeenCalled();
    });

    it('should not install anything when there is no formatter', async () => {
      await init(tree, { formatter: 'none' });

      expect(ensurePackage).not.toHaveBeenCalled();
    });

    it('should not install anything when NX_SKIP_FORMAT is set', async () => {
      // formatFiles returns immediately on this, so the install would be a
      // network round trip whose result is never read. create-nx-workspace
      // sets it for the whole run and formats once at the end.
      const previous = process.env.NX_SKIP_FORMAT;
      process.env.NX_SKIP_FORMAT = 'true';
      try {
        await init(tree, { formatter: 'oxfmt' });

        expect(ensurePackage).not.toHaveBeenCalled();
      } finally {
        if (previous === undefined) {
          delete process.env.NX_SKIP_FORMAT;
        } else {
          process.env.NX_SKIP_FORMAT = previous;
        }
      }
    });
  });

  it('should install prettier package', async () => {
    await init(tree, { formatter: 'prettier' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['prettier']).toBeDefined();
  });

  it('should add oxfmt to devDependencies and create .oxfmtrc.json', async () => {
    await init(tree, { formatter: 'oxfmt' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['oxfmt']).toBeDefined();
    expect(packageJson.devDependencies['prettier']).toBeUndefined();

    const oxfmtrc = readJson(tree, '.oxfmtrc.json');
    expect(oxfmtrc).toEqual({ singleQuote: true });
  });

  describe('default formatter', () => {
    // The default resolves three ways and each arm is user-visible, so none of
    // them may rely on a caller passing `formatter` explicitly.

    it('should default to oxfmt when the workspace has no formatter configured', async () => {
      await init(tree, {});

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['oxfmt']).toBeDefined();
      expect(packageJson.devDependencies['prettier']).toBeUndefined();
      expect(tree.exists('.oxfmtrc.json')).toBe(true);
    });

    it('should keep prettier when the workspace already uses it', async () => {
      writeJson(tree, '.prettierrc', { singleQuote: true });

      await init(tree, {});

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['prettier']).toBeDefined();
      expect(packageJson.devDependencies['oxfmt']).toBeUndefined();
      // A stray .oxfmtrc.json here would win detection over the .prettierrc
      // and silently switch the workspace's formatter.
      expect(tree.exists('.oxfmtrc.json')).toBe(false);
    });

    it('should default to no formatter under the TS solution setup', async () => {
      await init(tree, { addTsPlugin: true });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['oxfmt']).toBeUndefined();
      expect(packageJson.devDependencies['prettier']).toBeUndefined();
      expect(tree.exists('.oxfmtrc.json')).toBe(false);
    });
  });

  it('should not overwrite existing .oxfmtrc.json', async () => {
    writeJson(tree, '.oxfmtrc.json', { singleQuote: false });

    await init(tree, { formatter: 'oxfmt' });

    const oxfmtrc = readJson(tree, '.oxfmtrc.json');
    expect(oxfmtrc).toEqual({ singleQuote: false });
  });

  it('should not create .oxfmtrc.json if another oxfmt config format exists', async () => {
    tree.write('oxfmt.config.ts', 'export default {};');

    await init(tree, { formatter: 'oxfmt' });

    expect(tree.exists('.oxfmtrc.json')).toBeFalsy();
  });

  it('should create .prettierrc and .prettierignore files', async () => {
    await init(tree, { formatter: 'prettier' });

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

  it('should not write .prettierrc next to a prettier.config.ts', async () => {
    // The setup list is shared with detection now; it previously omitted the
    // .ts/.mts/.cts forms, so a workspace using one got a second config.
    tree.write('prettier.config.ts', 'export default { singleQuote: true };');

    await init(tree, { formatter: 'prettier' });

    expect(tree.exists('.prettierrc')).toBe(false);
  });

  it('should not overwrite prettier configuration specified in other formats', async () => {
    tree.delete('.prettierrc');
    tree.delete('.prettierignore');
    tree.write('.prettierrc.js', `module.exports = { singleQuote: true };`);

    await init(tree, { formatter: 'prettier' });

    expect(tree.exists('.prettierrc')).toBeFalsy();
    expect(tree.exists('.prettierignore')).toBeTruthy();
    expect(tree.read('.prettierrc.js', 'utf-8')).toContain(
      `module.exports = { singleQuote: true };`
    );
  });

  it('should add prettier vscode extension if .vscode/extensions.json file exists', async () => {
    // No existing recommendations
    writeJson(tree, '.vscode/extensions.json', {});

    await init(tree, { formatter: 'prettier' });

    let json = readJson(tree, '.vscode/extensions.json');
    expect(json).toEqual({
      recommendations: ['esbenp.prettier-vscode'],
    });

    // Existing recommendations
    writeJson(tree, '.vscode/extensions.json', { recommendations: ['foo'] });

    await init(tree, { formatter: 'prettier' });

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

  it('should throw when the installed typescript version is below the supported floor', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, typescript: '~4.5.0' };
      return json;
    });

    await expect(init(tree, {})).rejects.toThrow(
      'Unsupported version of `typescript` detected'
    );
  });

  it('should not overwrite installed typescript version when is a supported version', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, typescript: '~5.8.3' };
      return json;
    });

    await init(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['typescript']).toBe('~5.8.3');
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
          "customConditions": ["@proj/source"]
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
