import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;
  const name = 'my-app';

  describe('generated files content - as-provided', () => {
    describe('general application', () => {
      beforeAll(async () => {
        tree = createTreeWithEmptyWorkspace();
        await applicationGenerator(tree, {
          name,
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'vitest',
        });
      });
      it('should create all new files in the correct location', async () => {
        const newFiles = tree.listChanges().map((change) => change.path);
        expect(newFiles).toMatchSnapshot();
      });

      it('should add nuxt entries in .gitignore', () => {
        expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
      });

      it('should configure nuxt correctly', () => {
        expect(tree.read('my-app/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
      });

      it('should configure eslint correctly', () => {
        expect(tree.read('my-app/.eslintrc.json', 'utf-8')).toMatchSnapshot();
      });

      it('should configure vitest correctly', () => {
        expect(tree.read('my-app/vitest.config.ts', 'utf-8')).toMatchSnapshot();
        expect(
          tree.read('my-app/tsconfig.spec.json', 'utf-8')
        ).toMatchSnapshot();
        expect(tree.read('my-app/tsconfig.json', 'utf-8')).toMatchSnapshot();
        const packageJson = readJson(tree, 'package.json');
        expect(packageJson.devDependencies['vitest']).toEqual('^1.0.4');
      });

      it('should configure tsconfig and project.json correctly', () => {
        expect(tree.read('my-app/project.json', 'utf-8')).toMatchSnapshot();
        expect(tree.read('my-app/tsconfig.json', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('styles setup', () => {
      beforeAll(async () => {
        tree = createTreeWithEmptyWorkspace();
      });
      it('should configure css', async () => {
        await applicationGenerator(tree, {
          name: 'myapp1',
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'none',
          style: 'css',
        });
        expect(tree.exists('myapp1/src/assets/css/styles.css')).toBeTruthy();
        expect(tree.read('myapp1/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
      });

      it('should configure scss', async () => {
        await applicationGenerator(tree, {
          name: 'myapp2',
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'none',
          style: 'scss',
        });
        expect(tree.exists('myapp2/src/assets/css/styles.scss')).toBeTruthy();
        expect(tree.read('myapp2/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
      });

      it('should configure less', async () => {
        await applicationGenerator(tree, {
          name: 'myapp3',
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'none',
          style: 'less',
        });
        expect(tree.exists('myapp3/src/assets/css/styles.less')).toBeTruthy();
        expect(tree.read('myapp3/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
      });

      it('should not configure styles', async () => {
        await applicationGenerator(tree, {
          name: 'myapp4',
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'none',
          style: 'none',
        });
        expect(tree.exists('myapp4/src/assets/css/styles.css')).toBeFalsy();
        expect(tree.read('myapp4/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
      });
    });

    describe('pcv3', () => {
      let originalValue: string | undefined;
      beforeEach(() => {
        tree = createTreeWithEmptyWorkspace();
        originalValue = process.env['NX_PCV3'];
        process.env['NX_PCV3'] = 'true';
      });

      afterEach(() => {
        if (originalValue) {
          process.env['NX_PCV3'] = originalValue;
        } else {
          delete process.env['NX_PCV3'];
        }
      });

      it('should not add targets', async () => {
        await applicationGenerator(tree, {
          name,
          projectNameAndRootFormat: 'as-provided',
          unitTestRunner: 'vitest',
        });

        const projectConfi = readProjectConfiguration(tree, name);
        expect(projectConfi.targets.build).toBeUndefined();
        expect(projectConfi.targets.serve).toBeUndefined();
        expect(projectConfi.targets.test).toBeUndefined();
      });
    });
  });
});
