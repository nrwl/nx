import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { dirname } from 'path';
import {
  AppConfig,
  createApp,
  createLib,
  getAppConfig,
  getLibConfig,
} from '../../utils/nx-devkit/testing';
import { ngrxGenerator } from './ngrx';
import { NgRxGeneratorOptions } from './schema';

describe('NgRx generator', () => {
  let appConfig: AppConfig;
  let statePath: string;
  let tree: Tree;

  const defaultOptions: NgRxGeneratorOptions = {
    directory: '+state',
    minimal: true,
    module: 'apps/myapp/src/app/app.module.ts',
    name: 'users',
    useDataPersistence: false,
    syntax: 'classes',
  };

  const expectFileToExist = (file: string) =>
    expect(tree.exists(file)).toBeTruthy();
  const expectFileToNotExist = (file: string) =>
    expect(tree.exists(file)).not.toBeTruthy();

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    createApp(tree, 'myapp');
    appConfig = getAppConfig();
    statePath = `${dirname(appConfig.appModule)}/+state`;
  });

  describe('classes syntax', () => {
    it('should generate files without a facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
      expectFileToNotExist(`${statePath}/users.facade.ts`);
      expectFileToNotExist(`${statePath}/users.facade.spec.ts`);
    });

    it('should generate files with a facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        facade: true,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.facade.ts`);
      expectFileToExist(`${statePath}/users.facade.spec.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
    });

    it('should generate the ngrx actions', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.actions.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx effects', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.effects.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx facade', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        facade: true,
      });

      expect(
        tree.read(`${statePath}/users.facade.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx reducer', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.reducer.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate the ngrx selectors', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
      });

      expect(
        tree.read(`${statePath}/users.selectors.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should use DataPersistence when useDataPersistence is true', async () => {
      await ngrxGenerator(tree, {
        ...defaultOptions,
        module: appConfig.appModule,
        minimal: false,
        useDataPersistence: true,
      });

      expect(
        tree.read(`${statePath}/users.effects.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate with custom directory', async () => {
      statePath = '/apps/myapp/src/app/my-custom-directory';

      await ngrxGenerator(tree, {
        ...defaultOptions,
        directory: 'my-custom-directory',
        minimal: false,
        facade: true,
      });

      expectFileToExist(`${statePath}/users.actions.ts`);
      expectFileToExist(`${statePath}/users.effects.ts`);
      expectFileToExist(`${statePath}/users.effects.spec.ts`);
      expectFileToExist(`${statePath}/users.facade.ts`);
      expectFileToExist(`${statePath}/users.facade.spec.ts`);
      expectFileToExist(`${statePath}/users.reducer.ts`);
      expectFileToExist(`${statePath}/users.reducer.spec.ts`);
      expectFileToExist(`${statePath}/users.selectors.ts`);
      expectFileToExist(`${statePath}/users.selectors.spec.ts`);
    });

    it('should update the entry point file with the right exports', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: true,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    it('should update the entry point file correctly when barrels is true', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: true,
        barrels: true,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    it('should update the entry point file with no facade', async () => {
      createLib(tree, 'flights');
      let libConfig = getLibConfig();

      await ngrxGenerator(tree, {
        ...defaultOptions,
        name: 'super-users',
        module: libConfig.module,
        facade: false,
      });

      expect(tree.read(libConfig.barrel, 'utf-8')).toMatchSnapshot();
    });

    describe('unit tests', () => {
      it('should generate specs for the ngrx effects', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.effects.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx effects correctly when useDataPersistence is true', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
          useDataPersistence: true,
        });

        expect(
          tree.read(`${statePath}/super-users.effects.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx facade', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
          facade: true,
        });

        expect(
          tree.read(`${statePath}/super-users.facade.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx reducer', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.reducer.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });

      it('should generate specs for the ngrx selectors', async () => {
        await ngrxGenerator(tree, {
          ...defaultOptions,
          name: 'super-users',
          module: appConfig.appModule,
          minimal: false,
        });

        expect(
          tree.read(`${statePath}/super-users.selectors.spec.ts`, 'utf-8')
        ).toMatchSnapshot();
      });
    });
  });
});
