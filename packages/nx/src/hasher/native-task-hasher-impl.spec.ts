import { TempFs } from '../internal-testing-utils/temp-fs';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { NxJsonConfiguration } from '../config/nx-json';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import { NativeTaskHasherImpl } from './native-task-hasher-impl';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { testOnlyTransferFileMap } from '../native';

describe('native task hasher', () => {
  let tempFs: TempFs;
  const packageJson = {
    name: 'nrwl',
  };

  const tsConfigBaseJson = JSON.stringify({
    compilerOptions: {
      paths: {
        '@nx/parent': ['libs/parent/src/index.ts'],
        '@nx/child': ['libs/child/src/index.ts'],
      },
    },
  });

  const nxJson: NxJsonConfiguration = {
    namedInputs: {
      default: ['{projectRoot}/**/*', 'sharedGlobals'],
      production: ['default'],
      sharedGlobals: [],
    },
    targetDefaults: {
      build: {
        cache: true,
        dependsOn: ['^build'],
        inputs: ['production', '^production'],
      },
    },
  };

  beforeEach(async () => {
    tempFs = new TempFs('NativeTaskHasher');
    await tempFs.createFiles({
      'libs/parent/src/index.ts': 'parent-content',
      'libs/parent/project.json': JSON.stringify({
        name: 'parent',
        targets: {
          build: {
            executor: 'nx:run-commands',
          },
        },
      }),
      'libs/parent/filea.ts': 'filea-content',
      'libs/parent/filea.spec.ts': 'test-content',
      'libs/child/fileb.ts': 'child-content',
      'libs/child/fileb.spec.ts': 'test-content',
      'libs/child/src/index.ts': 'child-content',
      'libs/child/project.json': JSON.stringify({ name: 'child' }),
      'libs/unrelated/project.json': JSON.stringify({
        name: 'unrelated',
        targets: { build: {} },
      }),
      'libs/unrelated/filec.ts': 'filec-content',
      'libs/tagged/project.json': JSON.stringify({
        name: 'tagged',
        targets: { build: {} },
        tags: ['some-tag'],
      }),
      global1: 'global1-content',
      global2: 'global2-content',
      'tsconfig.base.json': tsConfigBaseJson,
      // 'yarn.lock': 'content',
      'package.json': JSON.stringify(packageJson),
      'nx.json': JSON.stringify(nxJson),
    });
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should create a task hash', async () => {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/unrelated': 'unrelated',
      'libs/tagged': 'tagged',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );

    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            executor: 'nx:run-commands',
            inputs: [
              'default',
              '^default',
              { runtime: 'echo runtime123' },
              { env: 'TESTENV' },
              { env: 'NONEXISTENTENV' },
              {
                input: 'default',
                projects: ['unrelated', 'tag:some-tag'],
              },
            ],
          },
        },
      },
    });
    builder.addNode({
      name: 'unrelated',
      type: 'lib',
      data: {
        root: 'libs/unrelated',
        targets: { build: {} },
      },
    });
    builder.addNode({
      name: 'tagged',
      type: 'lib',
      data: {
        root: 'libs/tagged',
        targets: { build: {} },
        tags: ['some-tag'],
      },
    });
    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );

    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTasks(Object.values(taskGraph.tasks), taskGraph, {
      TESTENV: 'test',
    });

    expect(hash).toMatchInlineSnapshot(`
      [
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "env:NONEXISTENTENV": "3244421341483603138",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "env:TESTENV": "11441948532827618368",
            "parent:ProjectConfiguration": "3608670998275221195",
            "parent:TsConfig": "2264969541778889434",
            "parent:{projectRoot}/**/*": "17059468255294227635",
            "runtime:echo runtime123": "29846575039086708",
            "tagged:ProjectConfiguration": "8596726088057301092",
            "tagged:TsConfig": "2264969541778889434",
            "tagged:{projectRoot}/**/*": "14666997081331501901",
            "unrelated:ProjectConfiguration": "11133337791644294114",
            "unrelated:TsConfig": "2264969541778889434",
            "unrelated:{projectRoot}/**/*": "4127219831408253695",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "18099427347122160586",
          },
          "value": "391066910278240047",
        },
      ]
    `);
  });

  it('should hash tasks where the project has dependencies', async () => {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );

    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: { build: { executor: 'unknown' } },
      },
    });

    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        targets: { build: { executor: 'none' } },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');

    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );

    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph.tasks['parent:build'], taskGraph, {});

    expect(hash).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "child:ProjectConfiguration": "710102491746666394",
          "child:TsConfig": "2264969541778889434",
          "child:{projectRoot}/**/*": "3347149359534435991",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:ProjectConfiguration": "8031122597231773116",
          "parent:TsConfig": "2264969541778889434",
          "parent:{projectRoot}/**/*": "17059468255294227635",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "18099427347122160586",
        },
        "value": "2068118780828544905",
      }
    `);
  });

  it('should plan non-default filesets', async () => {
    let nxJsonModified = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    } as any;
    tempFs.writeFile('nx.json', JSON.stringify(nxJsonModified));

    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
    });

    let builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );

    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            inputs: ['prod', '^prod'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        namedInputs: {
          prod: ['default'],
        },
        targets: { build: { executor: 'unknown' } },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');

    let projectGraph = builder.getUpdatedProjectGraph();

    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJsonModified,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph.tasks['parent:build'], taskGraph, {});

    expect(hash).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "child:ProjectConfiguration": "13051054958929525761",
          "child:TsConfig": "2264969541778889434",
          "child:{projectRoot}/**/*": "3347149359534435991",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:!{projectRoot}/**/*.spec.ts": "8911122541468969799",
          "parent:ProjectConfiguration": "3608670998275221195",
          "parent:TsConfig": "2264969541778889434",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "11114659294156087056",
        },
        "value": "7780216706447676384",
      }
    `);
  });

  it('should make a plan with multiple filesets of a project', async () => {
    let nxJson = {
      namedInputs: {
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    };
    tempFs.writeFile('nx.json', JSON.stringify(nxJson));
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
    });
    let builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            inputs: ['prod'],
            executor: 'nx:run-commands',
          },
          test: {
            inputs: ['default'],
            dependsOn: ['build'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    let projectGraph = builder.getUpdatedProjectGraph();

    let taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['parent'],
      ['build', 'test'],
      undefined,
      {}
    );

    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTasks(Object.values(taskGraph.tasks), taskGraph, {});

    expect(hash).toMatchInlineSnapshot(`
      [
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "parent:!{projectRoot}/**/*.spec.ts": "8911122541468969799",
            "parent:ProjectConfiguration": "16402137858974842465",
            "parent:TsConfig": "2264969541778889434",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "11114659294156087056",
          },
          "value": "16063851723942996830",
        },
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "parent:ProjectConfiguration": "16402137858974842465",
            "parent:TsConfig": "2264969541778889434",
            "parent:{projectRoot}/**/*": "17059468255294227635",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "11114659294156087056",
          },
          "value": "1153029350223570014",
        },
      ]
    `);
  });

  it('should be able to handle multiple filesets per project', async () => {
    let nxJson = {
      namedInputs: {
        default: ['{projectRoot}/**/*', '{workspaceRoot}/global1'],
        prod: ['!{projectRoot}/**/*.spec.ts'],
      },
    };
    tempFs.writeFile('nx.json', JSON.stringify(nxJson));
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          test: {
            inputs: ['default', '^prod'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        namedInputs: {
          prod: [
            '!{projectRoot}/**/*.spec.ts',
            '{workspaceRoot}/global2',
            { env: 'MY_TEST_HASH_ENV' },
          ],
        },
        targets: {
          test: {
            inputs: ['default'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['test'],
      undefined,
      {}
    );
    let hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTasks(Object.values(taskGraph.tasks), taskGraph, {
      MY_TEST_HASH_ENV: 'MY_TEST_HASH_ENV_VALUE',
    });

    expect(hash).toMatchInlineSnapshot(`
      [
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "child:!{projectRoot}/**/*.spec.ts": "6212660753359890679",
            "child:ProjectConfiguration": "10085593111011845427",
            "child:TsConfig": "2264969541778889434",
            "env:MY_TEST_HASH_ENV": "17357374746554314488",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "parent:ProjectConfiguration": "14398811678394411425",
            "parent:TsConfig": "2264969541778889434",
            "parent:{projectRoot}/**/*": "17059468255294227635",
            "workspace:[{workspaceRoot}/global1]": "14542405497386871555",
            "workspace:[{workspaceRoot}/global2]": "12932836274958677781",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "12076281115618125366",
          },
          "value": "11623032905580707496",
        },
      ]
    `);
  });

  it('should be able to include only a part of the base tsconfig', async () => {
    let workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            inputs: ['default', '^prod'],
            executor: 'nx:run-commands',
          },
        },
      },
    });
    let projectGraph = builder.getUpdatedProjectGraph();
    let taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );

    let hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: true }
    ).hashTask(taskGraph.tasks['parent:build'], taskGraph, {});

    expect(hash).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:ProjectConfiguration": "3608670998275221195",
          "parent:TsConfig": "8661678577354855152",
          "parent:{projectRoot}/**/*": "17059468255294227635",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "18099427347122160586",
        },
        "value": "15449891577656158381",
      }
    `);
  });

  it('should hash tasks where the project graph has circular dependencies', async () => {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',

        targets: {
          build: {
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
    builder.addStaticDependency('child', 'parent', 'libs/child/fileb.ts');
    let projectGraph = builder.getUpdatedProjectGraph();

    const taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent', 'child'],
      ['build'],
      undefined,
      {}
    );

    let hasher = new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    );

    let taskHash = await hasher.hashTask(
      taskGraph.tasks['parent:build'],
      taskGraph,
      {}
    );

    expect(taskHash).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "child:ProjectConfiguration": "13748859057138736105",
          "child:TsConfig": "2264969541778889434",
          "child:{projectRoot}/**/*": "3347149359534435991",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:ProjectConfiguration": "3608670998275221195",
          "parent:TsConfig": "2264969541778889434",
          "parent:{projectRoot}/**/*": "17059468255294227635",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "18099427347122160586",
        },
        "value": "7701541978018526456",
      }
    `);

    const hashb = await hasher.hashTask(
      taskGraph.tasks['child:build'],
      taskGraph,
      {}
    );

    expect(hashb).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "child:ProjectConfiguration": "13748859057138736105",
          "child:TsConfig": "2264969541778889434",
          "child:{projectRoot}/**/*": "3347149359534435991",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:ProjectConfiguration": "3608670998275221195",
          "parent:TsConfig": "2264969541778889434",
          "parent:{projectRoot}/**/*": "17059468255294227635",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "18099427347122160586",
        },
        "value": "7701541978018526456",
      }
    `);
  });

  it('should include typescript hash in the TsConfig final hash', async () => {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
    });
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'libs/parent',
        targets: {
          build: {
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addNode({
      name: 'child',
      type: 'lib',
      data: {
        root: 'libs/child',
        targets: {
          build: {
            executor: 'nx:run-commands',
          },
        },
      },
    });
    builder.addExternalNode({
      data: {
        packageName: 'typescript',
        version: '1.2.3',
        hash: '1234',
      },
      name: 'npm:typescript',
      type: 'npm',
    });

    builder.addStaticDependency(
      'parent',
      'npm:typescript',
      'libs/parent/filea.ts'
    );
    let projectGraph = builder.getUpdatedProjectGraph();

    const taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent', 'child'],
      ['build'],
      undefined,
      {}
    );

    let hasher = new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJson,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: true }
    );

    let typescriptHash = (
      await hasher.hashTask(taskGraph.tasks['parent:build'], taskGraph, {})
    ).details['parent:TsConfig'];

    let noTypescriptHash = (
      await hasher.hashTask(taskGraph.tasks['child:build'], taskGraph, {})
    ).details['child:TsConfig'];

    expect(typescriptHash).not.toEqual(noTypescriptHash);
    expect(typescriptHash).toMatchInlineSnapshot(`"8661678577354855152"`);
    expect(noTypescriptHash).toMatchInlineSnapshot(`"11547179436948425249"`);
  });

  /**
   * commented out to show how to debug issues with hashing
   *
   *
   *
   * gather the project graph + task graph with `nx run project:target --graph=graph.json`
   * gather the file-map.json from `.nx/cache/file-map.json`
   * gather the nx.json file
   */
  // it('should test client workspaces', async () => {
  //   let nxJson = require('nx.json');
  //   let graphs = require('graph.json');
  //   let projectGraph = graphs.graph;
  //   let taskGraph = graphs.tasks;
  //
  //   let files = require('file-map.json');
  //   let projectFiles = files.fileMap.projectFileMap;
  //   let nonProjectFiles = files.fileMap.nonProjectFiles;
  //
  //   let transferred = testOnlyTransferFileMap(projectFiles, nonProjectFiles);
  //
  //   let hasher = new NativeTaskHasherImpl(
  //     '',
  //     nxJson,
  //     projectGraph,
  //     transferred,
  //     { selectivelyHashTsConfig: false }
  //   );
  //
  //   const hashes = await hasher.hashTasks(
  //     Object.values(taskGraph.tasks),
  //     taskGraph,
  //     {}
  //   );
  //   console.dir(hashes, { depth: null });
  // });
});
