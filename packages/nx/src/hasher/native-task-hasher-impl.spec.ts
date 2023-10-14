import { TempFs } from '../internal-testing-utils/temp-fs';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { NxJsonConfiguration } from '../config/nx-json';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import { NativeTaskHasherImpl } from './native-task-hasher-impl';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';

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
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
    const builder = new ProjectGraphBuilder(
      undefined,
      workspaceFiles.fileMap.projectFileMap
    );
    builder.addNode({
      name: 'parent',
      type: 'lib',
      data: {
        root: 'parent',
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
            "env:TESTENV": "11441948532827618368",
            "parent:ProjectConfiguration": "15828052557461792163",
            "parent:TsConfig": "8767608672024750088",
            "parent:{projectRoot}/**/*": "3244421341483603138",
            "runtime:echo runtime123": "4574620953725957459",
            "tagged:ProjectConfiguration": "1604492097835699503",
            "tagged:TsConfig": "8767608672024750088",
            "tagged:{projectRoot}/**/*": "112200405683630828",
            "unrelated:ProjectConfiguration": "439515135357674343",
            "unrelated:TsConfig": "8767608672024750088",
            "unrelated:{projectRoot}/**/*": "10505120368757496776",
            "{workspaceRoot}/.gitignore": "3244421341483603138",
            "{workspaceRoot}/.nxignore": "3244421341483603138",
            "{workspaceRoot}/nx.json": "5219582320960288192",
          },
          "value": "11839885306987194209",
        },
      ]
    `);
  });

  it('should hash tasks where the project has dependencies', async () => {
    console.log('read first', await tempFs.readFile('nx.json'));
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
    console.dir(workspaceFiles.allWorkspaceFiles);
    console.log('read second', await tempFs.readFile('nx.json'));
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
          "child:ProjectConfiguration": "7051130583729928229",
          "child:TsConfig": "8767608672024750088",
          "child:{projectRoot}/**/*": "7694964870822928111",
          "parent:ProjectConfiguration": "7704699416930647320",
          "parent:TsConfig": "8767608672024750088",
          "parent:{projectRoot}/**/*": "15295586939211629225",
          "{workspaceRoot}/.gitignore": "3244421341483603138",
          "{workspaceRoot}/.nxignore": "3244421341483603138",
          "{workspaceRoot}/nx.json": "5219582320960288192",
        },
        "value": "9986866187239021632",
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

    const workspaceFiles = await retrieveWorkspaceFiles(
      tempFs.tempDir,
      nxJsonModified
    );

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
          "child:ProjectConfiguration": "2562552455862160288",
          "child:TsConfig": "8767608672024750088",
          "child:{projectRoot}/**/*": "7694964870822928111",
          "parent:!{projectRoot}/**/*.spec.ts": "3244421341483603138",
          "parent:ProjectConfiguration": "4131510303084753861",
          "parent:TsConfig": "8767608672024750088",
          "{workspaceRoot}/.gitignore": "3244421341483603138",
          "{workspaceRoot}/.nxignore": "3244421341483603138",
          "{workspaceRoot}/nx.json": "4641558175996703359",
        },
        "value": "16387071490547609647",
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
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
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
            "parent:!{projectRoot}/**/*.spec.ts": "3244421341483603138",
            "parent:ProjectConfiguration": "8008830016795210968",
            "parent:TsConfig": "8767608672024750088",
            "{workspaceRoot}/.gitignore": "3244421341483603138",
            "{workspaceRoot}/.nxignore": "3244421341483603138",
            "{workspaceRoot}/nx.json": "4641558175996703359",
          },
          "value": "10119565879833102470",
        },
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "parent:ProjectConfiguration": "8008830016795210968",
            "parent:TsConfig": "8767608672024750088",
            "parent:{projectRoot}/**/*": "15295586939211629225",
            "{workspaceRoot}/.gitignore": "3244421341483603138",
            "{workspaceRoot}/.nxignore": "3244421341483603138",
            "{workspaceRoot}/nx.json": "4641558175996703359",
          },
          "value": "12180958575393292434",
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
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
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
            "child:!{projectRoot}/**/*.spec.ts": "3244421341483603138",
            "child:ProjectConfiguration": "11541456798478268276",
            "child:TsConfig": "8767608672024750088",
            "env:MY_TEST_HASH_ENV": "17357374746554314488",
            "parent:ProjectConfiguration": "2287392686890337925",
            "parent:TsConfig": "8767608672024750088",
            "parent:{projectRoot}/**/*": "15295586939211629225",
            "{workspaceRoot}/.gitignore": "3244421341483603138",
            "{workspaceRoot}/.nxignore": "3244421341483603138",
            "{workspaceRoot}/global1": "13078141817211771580",
            "{workspaceRoot}/global2": "13625885481717016690",
            "{workspaceRoot}/nx.json": "10897751101872977225",
          },
          "value": "15479174797238914687",
        },
      ]
    `);
  });

  it('should be able to include only a part of the base tsconfig', async () => {
    let workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
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
          "parent:ProjectConfiguration": "4131510303084753861",
          "parent:TsConfig": "7574575146692353887",
          "parent:{projectRoot}/**/*": "15295586939211629225",
          "{workspaceRoot}/.gitignore": "3244421341483603138",
          "{workspaceRoot}/.nxignore": "3244421341483603138",
          "{workspaceRoot}/nx.json": "5219582320960288192",
        },
        "value": "2853407517225312967",
      }
    `);
  });

  it('should hash tasks where the project graph has circular dependencies', async () => {
    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, nxJson);
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
          "child:ProjectConfiguration": "3898391056798628885",
          "child:TsConfig": "8767608672024750088",
          "child:{projectRoot}/**/*": "7694964870822928111",
          "parent:ProjectConfiguration": "4131510303084753861",
          "parent:TsConfig": "8767608672024750088",
          "parent:{projectRoot}/**/*": "15295586939211629225",
          "{workspaceRoot}/.gitignore": "3244421341483603138",
          "{workspaceRoot}/.nxignore": "3244421341483603138",
          "{workspaceRoot}/nx.json": "5219582320960288192",
        },
        "value": "3660205316711836799",
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
          "child:ProjectConfiguration": "3898391056798628885",
          "child:TsConfig": "8767608672024750088",
          "child:{projectRoot}/**/*": "7694964870822928111",
          "parent:ProjectConfiguration": "4131510303084753861",
          "parent:TsConfig": "8767608672024750088",
          "parent:{projectRoot}/**/*": "15295586939211629225",
          "{workspaceRoot}/.gitignore": "3244421341483603138",
          "{workspaceRoot}/.nxignore": "3244421341483603138",
          "{workspaceRoot}/nx.json": "5219582320960288192",
        },
        "value": "3660205316711836799",
      }
    `);
  });
});
