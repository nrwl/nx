import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Schema } from '../schema';
import { normalizeSchema } from './normalize-schema';
import { updateImports } from './update-imports';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('updateImports', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    schema = {
      projectName: 'my-source',
      newProjectName: 'my-destination',
      destination: 'my-destination',
      updateImportPath: true,
      projectNameAndRootFormat: 'as-provided',
    };
  });

  it('should update project refs', async () => {
    // this is a bit of a cheat - we expect to run this rule on an intermediate state
    // tree where the workspace hasn't been updated yet, so just create libs representing
    // source and destination to make sure that the workspace has libraries with those names.
    await libraryGenerator(tree, {
      name: 'my-destination',
      config: 'project',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { MyClass } from '@proj/my-source';

        export class MyExtendedClass extends MyClass {};
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    expect(tree.read(importerFilePath, 'utf-8')).toMatchSnapshot();
  });

  /**
   * Ensure that import paths are only updated if they are an exact match.
   * For example '@proj/table' contains '@proj/tab', however it should not
   * be updated.
   */
  it('should not update import paths when they contain a partial match', async () => {
    await libraryGenerator(tree, {
      name: 'table',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'tab',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { Table } from '@proj/table';
        import { Tab } from '@proj/tab';

        export class MyTable extends Table {};
        export class MyTab extends Tab {};
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'tab');

    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: '@proj/tabs',
        updateImportPath: true,
        newProjectName: 'tabs',
        relativeToRootDestination: 'tabs',
      },
      projectConfig
    );

    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import { Table } from '@proj/table';`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import { Tab } from '@proj/tabs';`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toMatchSnapshot();
  });

  it('should correctly update deep imports', async () => {
    await libraryGenerator(tree, {
      name: 'table',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'tab',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { Table } from '@proj/table/components';
        import { Tab } from '@proj/tab/components';

        export class MyTable extends Table {};
        export class MyTab extends Tab {};
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'tab');

    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: '@proj/tabs',
        updateImportPath: true,
        newProjectName: 'tabs',
        relativeToRootDestination: 'tabs',
      },
      projectConfig
    );

    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import { Table } from '@proj/table/components';`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import { Tab } from '@proj/tabs/components';`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toMatchSnapshot();
  });

  it('should update dynamic imports', async () => {
    await libraryGenerator(tree, {
      name: 'table',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'tab',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
      import('@proj/table').then(m => m.Table);
      import('@proj/table/components').then(m => m.Table);
      import('@proj/tab').then(m => m.Tab);
      import('@proj/tab/components').then(m => m.Tab);
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'tab');

    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: '@proj/tabs',
        updateImportPath: true,
        newProjectName: 'tabs',
        relativeToRootDestination: 'tabs',
      },
      projectConfig
    );

    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import('@proj/table').then(m => m.Table);`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import('@proj/table/components').then(m => m.Table);`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import('@proj/tabs').then(m => m.Tab);`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toContain(
      `import('@proj/tabs/components').then(m => m.Tab);`
    );
    expect(tree.read(importerFilePath, 'utf-8')).toMatchSnapshot();
  });

  it('should update imports and reexports', async () => {
    await libraryGenerator(tree, {
      name: 'my-destination',
      config: 'project',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { MyClass } from '@proj/my-source';
        
        export { MyClass };
        export { MyOtherClass } from '@proj/my-source';
        
        export class MyExtendedClass extends MyClass {};
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    expect(tree.read(importerFilePath, 'utf-8')).toMatchSnapshot();
  });

  it('should not throw error on export list', async () => {
    await libraryGenerator(tree, {
      name: 'my-destination',
      config: 'project',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
        import { MyClass } from '@proj/my-source';

        export { MyClass };
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    const normalizedSchema = await normalizeSchema(tree, schema, projectConfig);

    expect(() =>
      updateImports(tree, normalizedSchema, projectConfig)
    ).not.toThrow();
  });

  it('should update require imports', async () => {
    await libraryGenerator(tree, {
      name: 'table',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'tab',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `
      require('@proj/table');
      require('@proj/table/components');
      require('@proj/tab');
      require('@proj/tab/components');
      `
    );
    const projectConfig = readProjectConfiguration(tree, 'tab');

    updateImports(
      tree,
      {
        projectName: 'tab',
        destination: 'tabs',
        importPath: '@proj/tabs',
        updateImportPath: true,
        newProjectName: 'tabs',
        relativeToRootDestination: 'tabs',
      },
      projectConfig
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `require('@proj/table');`
    );
    expect(tree.read(importerFilePath).toString()).toContain(
      `require('@proj/table/components');`
    );
    expect(tree.read(importerFilePath).toString()).toContain(
      `require('@proj/tabs');`
    );
    expect(tree.read(importerFilePath).toString()).toContain(
      `require('@proj/tabs/components');`
    );
  });

  it('should not update project refs when --updateImportPath=false', async () => {
    // this is a bit of a cheat - we expect to run this rule on an intermediate state
    // tree where the workspace hasn't been updated yet, so just create libs representing
    // source and destination to make sure that the workspace has libraries with those names.
    await libraryGenerator(tree, {
      name: 'my-destination',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-importer',
      projectNameAndRootFormat: 'as-provided',
    });
    const importerFilePath = 'my-importer/src/importer.ts';
    tree.write(
      importerFilePath,
      `import { MyClass } from '@proj/my-source';

export MyExtendedClass extends MyClass {};`
    );
    schema.updateImportPath = false;
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(
        tree,
        {
          ...schema,
          updateImportPath: false,
        },
        projectConfig
      ),
      projectConfig
    );

    expect(tree.read(importerFilePath).toString()).toContain(
      `import { MyClass } from '@proj/my-source';`
    );
  });

  it('should update project ref in the root tsconfig.base.json', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['my-destination/src/index.ts'],
    });
  });

  it('should update project ref in the root tsconfig.base.json for secondary entry points', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    updateJson(tree, '/tsconfig.base.json', (json) => {
      json.compilerOptions.paths['@proj/my-source/testing'] = [
        'my-source/testing/src/index.ts',
      ];
      json.compilerOptions.paths['@proj/different-alias'] = [
        'my-source/some-path/src/index.ts',
      ];
      return json;
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['my-destination/src/index.ts'],
      '@proj/my-destination/testing': ['my-destination/testing/src/index.ts'],
      '@proj/different-alias': ['my-destination/some-path/src/index.ts'],
    });
  });

  it('should update project ref of a project not under libs in the root tsconfig.base.json', async () => {
    tree.delete('libs');
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['my-destination/src/index.ts'],
    });
  });

  it('should update project ref in the root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['my-destination/src/index.ts'],
    });
  });

  it('should update project ref in the root tsconfig.json when there is a comment', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');
    tree.write(
      'tsconfig.json',
      `// A comment\n${tree.read('tsconfig.json', 'utf-8')}`
    );
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(tree, schema, projectConfig),
      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-destination': ['my-destination/src/index.ts'],
    });
  });

  it('should only update the project ref paths in the tsconfig file when --updateImportPath=false', async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-source');

    updateImports(
      tree,
      await normalizeSchema(
        tree,
        {
          ...schema,
          updateImportPath: false,
        },
        projectConfig
      ),

      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-source': ['my-destination/src/index.ts'],
    });
  });

  it("should update project ref in the root tsconfig file if it contains a secondary entry point for Next.js's server", async () => {
    await libraryGenerator(tree, {
      name: 'my-source',
      projectNameAndRootFormat: 'as-provided',
    });

    tree.write('my-source/src/server.ts', '');

    updateJson(tree, '/tsconfig.base.json', (json) => {
      json.compilerOptions.paths['@proj/my-source/server'] = [
        'my-source/src/server.ts',
      ];
      return json;
    });

    const projectConfig = readProjectConfiguration(tree, 'my-source');
    updateImports(
      tree,
      await normalizeSchema(
        tree,
        {
          ...schema,
          updateImportPath: false,
        },
        projectConfig
      ),

      projectConfig
    );

    const tsConfig = readJson(tree, '/tsconfig.base.json');
    expect(tsConfig.compilerOptions.paths).toEqual({
      '@proj/my-source': ['my-destination/src/index.ts'],
      '@proj/my-source/server': ['my-destination/src/server.ts'],
    });
  });
});
