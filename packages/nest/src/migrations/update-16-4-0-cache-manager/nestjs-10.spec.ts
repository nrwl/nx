import {
  ProjectConfiguration,
  ProjectGraph,
  Tree,
  addProjectConfiguration,
  readJson,
} from '@nx/devkit';
import {
  updateNestJs10,
  updateCacheManagerImport,
  updateTsConfigTarget,
} from './nestjs-10-updates';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));
describe('nestjs 10 migration changes', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    jest.resetAllMocks();
  });

  it('should update nestjs project', async () => {
    tree.write(
      'apps/app1/main.ts',
      `
/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CacheModule } from '@nestjs/common';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log('🚀 Application is running on: http://localhost:' + port + '/' + globalPrefix);
}

bootstrap();
`
    );

    tree.write(
      'apps/app1/tsconfig.app.json',
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          module: 'commonjs',
          types: ['node'],
          emitDecoratorMetadata: true,
          target: 'es2015',
        },
        exclude: ['jest.config.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
        include: ['src/**/*.ts'],
      })
    );
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          build: {
            executor: '@nx/webpack:webpack',
            options: {
              tsConfig: 'apps/app1/tsconfig.app.json',
            },
          },
        },
      },
      ['npm:@nestjs/common']
    );

    await updateNestJs10(tree);

    expect(readJson(tree, 'package.json').dependencies).toMatchInlineSnapshot(`
      {
        "@nestjs/cache-manager": "^2.0.0",
        "cache-manager": "^5.2.3",
      }
    `);
    expect(
      readJson(tree, 'apps/app1/tsconfig.app.json').compilerOptions.target
    ).toEqual('es2021');
    expect(tree.read('apps/app1/main.ts', 'utf-8')).toContain(
      "import { CacheModule } from '@nestjs/cache-manager';"
    );
  });

  it('should work with non buildable lib', async () => {
    tree.write(
      'libs/lib1/src/lib/lib1.module.ts',
      `
import { Module, CacheModule } from '@nestjs/common';

@Module({
  controllers: [],
  providers: [],
  exports: [],
  imports: [CacheModule.register()],
})
export class LibOneModule {}
`
    );

    tree.write(
      'libs/lib1/tsconfig.lib.json',
      JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: {
          outDir: '../../dist/out-tsc',
          module: 'commonjs',
          types: ['node'],
          emitDecoratorMetadata: true,
          target: 'es6',
        },
        exclude: ['jest.config.ts', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
        include: ['src/**/*.ts'],
      })
    );
    addProject(
      tree,
      'app1',
      {
        root: 'libs/lib1',
        targets: {},
      },
      ['npm:@nestjs/common']
    );

    await updateNestJs10(tree);

    expect(readJson(tree, 'package.json').dependencies).toMatchInlineSnapshot(`
      {
        "@nestjs/cache-manager": "^2.0.0",
        "cache-manager": "^5.2.3",
      }
    `);
    expect(
      readJson(tree, 'libs/lib1/tsconfig.lib.json').compilerOptions.target
    ).toEqual('es2021');
    expect(tree.read('libs/lib1/src/lib/lib1.module.ts', 'utf-8')).toContain(
      "import { CacheModule } from '@nestjs/cache-manager';"
    );
  });

  it('should update cache module import', () => {
    tree.write(
      'main.ts',
      `
import { Module, CacheModule } from '@nestjs/common';
const { Module, CacheModule } = require('@nestjs/common');
`
    );
    const actual = updateCacheManagerImport(tree, 'main.ts');

    expect(tree.read('main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "
      import { Module,  } from '@nestjs/common';
      import { CacheModule } from '@nestjs/cache-manager';
      const { Module,  } = require('@nestjs/common');
      const { CacheModule } = require('@nestjs/cache-manager')
      "
    `);
    expect(actual).toBe(true);
  });

  it('should NOT update cache module imports', () => {
    tree.write(
      'main.ts',
      `
import { AnotherModule } from '@nestjs/common';
const { AnotherModule } = require('@nestjs/common');
`
    );
    const actual = updateCacheManagerImport(tree, 'main.ts');

    expect(tree.read('main.ts', 'utf-8')).toMatchInlineSnapshot(`
      "
      import { AnotherModule } from '@nestjs/common';
      const { AnotherModule } = require('@nestjs/common');
      "
    `);
    expect(actual).toBeUndefined();
  });

  it('should update script target', () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { target: 'es6' } })
    );
    updateTsConfigTarget(tree, 'tsconfig.json');
    expect(readJson(tree, 'tsconfig.json').compilerOptions.target).toBe(
      'es2021'
    );
  });

  it('should NOT update script if over es2021', () => {
    tree.write(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { target: 'es2022' } })
    );
    updateTsConfigTarget(tree, 'tsconfig.json');
    expect(readJson(tree, 'tsconfig.json').compilerOptions.target).toBe(
      'es2022'
    );
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration,
  dependencies: string[]
): void {
  projectGraph = {
    dependencies: {
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      [projectName]: { data: config, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}
