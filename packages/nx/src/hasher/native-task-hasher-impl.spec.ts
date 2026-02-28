import { TempFs } from '../internal-testing-utils/temp-fs';
import { retrieveWorkspaceFiles } from '../project-graph/utils/retrieve-workspace-files';
import { NxJsonConfiguration } from '../config/nx-json';
import { createTaskGraph } from '../tasks-runner/create-task-graph';
import { NativeTaskHasherImpl } from './native-task-hasher-impl';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';

// Helper to normalize hash results for deterministic snapshot comparison
// (parallel processing may produce inputs in arbitrary order)
function sortHashInputs(hashResults: any[] | any): any[] | any {
  const sortOne = (result: any) => ({
    ...result,
    inputs: {
      ...result.inputs,
      files: [...result.inputs.files].sort(),
      runtime: [...result.inputs.runtime].sort(),
      environment: [...result.inputs.environment].sort(),
      depOutputs: [...result.inputs.depOutputs].sort(),
      external: [...result.inputs.external].sort(),
    },
  });
  return Array.isArray(hashResults)
    ? hashResults.map(sortOne)
    : sortOne(hashResults);
}

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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
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
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "6993407921919898285",
          },
          "inputs": {
            "depOutputs": [],
            "environment": [
              "NONEXISTENTENV",
              "NX_CLOUD_ENCRYPTION_KEY",
              "TESTENV",
            ],
            "external": [
              "AllExternalDependencies",
            ],
            "files": [
              "libs/parent/filea.spec.ts",
              "libs/parent/filea.ts",
              "libs/parent/project.json",
              "libs/parent/src/index.ts",
              "libs/tagged/project.json",
              "libs/unrelated/filec.ts",
              "libs/unrelated/project.json",
              "nx.json",
              "tsconfig.base.json",
            ],
            "runtime": [
              "echo runtime123",
            ],
          },
          "value": "15987635381237972716",
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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
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
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "6993407921919898285",
        },
        "inputs": {
          "depOutputs": [],
          "environment": [
            "NX_CLOUD_ENCRYPTION_KEY",
          ],
          "external": [
            "AllExternalDependencies",
          ],
          "files": [
            "libs/child/fileb.spec.ts",
            "libs/child/fileb.ts",
            "libs/child/project.json",
            "libs/child/src/index.ts",
            "libs/parent/filea.spec.ts",
            "libs/parent/filea.ts",
            "libs/parent/project.json",
            "libs/parent/src/index.ts",
            "nx.json",
            "tsconfig.base.json",
          ],
          "runtime": [],
        },
        "value": "10262178246623018030",
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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
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
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "9567402949680805009",
        },
        "inputs": {
          "depOutputs": [],
          "environment": [
            "NX_CLOUD_ENCRYPTION_KEY",
          ],
          "external": [
            "AllExternalDependencies",
          ],
          "files": [
            "libs/child/fileb.spec.ts",
            "libs/child/fileb.ts",
            "libs/child/project.json",
            "libs/child/src/index.ts",
            "libs/parent/filea.ts",
            "libs/parent/project.json",
            "libs/parent/src/index.ts",
            "nx.json",
            "tsconfig.base.json",
          ],
          "runtime": [],
        },
        "value": "14320402761058545796",
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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
      [
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "parent:!{projectRoot}/**/*.spec.ts": "8911122541468969799",
            "parent:ProjectConfiguration": "16402137858974842465",
            "parent:TsConfig": "2264969541778889434",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "9567402949680805009",
          },
          "inputs": {
            "depOutputs": [],
            "environment": [
              "NX_CLOUD_ENCRYPTION_KEY",
            ],
            "external": [
              "AllExternalDependencies",
            ],
            "files": [
              "libs/parent/filea.ts",
              "libs/parent/project.json",
              "libs/parent/src/index.ts",
              "nx.json",
              "tsconfig.base.json",
            ],
            "runtime": [],
          },
          "value": "2453961902871518313",
        },
        {
          "details": {
            "AllExternalDependencies": "3244421341483603138",
            "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
            "parent:ProjectConfiguration": "16402137858974842465",
            "parent:TsConfig": "2264969541778889434",
            "parent:{projectRoot}/**/*": "17059468255294227635",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "9567402949680805009",
          },
          "inputs": {
            "depOutputs": [],
            "environment": [
              "NX_CLOUD_ENCRYPTION_KEY",
            ],
            "external": [
              "AllExternalDependencies",
            ],
            "files": [
              "libs/parent/filea.spec.ts",
              "libs/parent/filea.ts",
              "libs/parent/project.json",
              "libs/parent/src/index.ts",
              "nx.json",
              "tsconfig.base.json",
            ],
            "runtime": [],
          },
          "value": "5894031627295207190",
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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
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
            "workspace:[{workspaceRoot}/global1]": "11580065831422255455",
            "workspace:[{workspaceRoot}/global2]": "6389465682922235219",
            "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "1359893257201181462",
          },
          "inputs": {
            "depOutputs": [],
            "environment": [
              "MY_TEST_HASH_ENV",
              "NX_CLOUD_ENCRYPTION_KEY",
            ],
            "external": [
              "AllExternalDependencies",
            ],
            "files": [
              "global1",
              "global2",
              "libs/child/fileb.ts",
              "libs/child/project.json",
              "libs/child/src/index.ts",
              "libs/parent/filea.spec.ts",
              "libs/parent/filea.ts",
              "libs/parent/project.json",
              "libs/parent/src/index.ts",
              "nx.json",
              "tsconfig.base.json",
            ],
            "runtime": [],
          },
          "value": "12394084267697729491",
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

    expect(sortHashInputs(hash)).toMatchInlineSnapshot(`
      {
        "details": {
          "AllExternalDependencies": "3244421341483603138",
          "env:NX_CLOUD_ENCRYPTION_KEY": "3244421341483603138",
          "parent:ProjectConfiguration": "3608670998275221195",
          "parent:TsConfig": "8661678577354855152",
          "parent:{projectRoot}/**/*": "17059468255294227635",
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "6993407921919898285",
        },
        "inputs": {
          "depOutputs": [],
          "environment": [
            "NX_CLOUD_ENCRYPTION_KEY",
          ],
          "external": [
            "AllExternalDependencies",
          ],
          "files": [
            "libs/parent/filea.spec.ts",
            "libs/parent/filea.ts",
            "libs/parent/project.json",
            "libs/parent/src/index.ts",
            "nx.json",
            "tsconfig.base.json",
          ],
          "runtime": [],
        },
        "value": "16657264716563422624",
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

    expect(sortHashInputs(taskHash)).toMatchInlineSnapshot(`
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
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "6993407921919898285",
        },
        "inputs": {
          "depOutputs": [],
          "environment": [
            "NX_CLOUD_ENCRYPTION_KEY",
          ],
          "external": [
            "AllExternalDependencies",
          ],
          "files": [
            "libs/child/fileb.spec.ts",
            "libs/child/fileb.ts",
            "libs/child/project.json",
            "libs/child/src/index.ts",
            "libs/parent/filea.spec.ts",
            "libs/parent/filea.ts",
            "libs/parent/project.json",
            "libs/parent/src/index.ts",
            "nx.json",
            "tsconfig.base.json",
          ],
          "runtime": [],
        },
        "value": "1325637283470296766",
      }
    `);

    const hashb = await hasher.hashTask(
      taskGraph.tasks['child:build'],
      taskGraph,
      {}
    );

    expect(sortHashInputs(hashb)).toMatchInlineSnapshot(`
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
          "workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]": "6993407921919898285",
        },
        "inputs": {
          "depOutputs": [],
          "environment": [
            "NX_CLOUD_ENCRYPTION_KEY",
          ],
          "external": [
            "AllExternalDependencies",
          ],
          "files": [
            "libs/child/fileb.spec.ts",
            "libs/child/fileb.ts",
            "libs/child/project.json",
            "libs/child/src/index.ts",
            "libs/parent/filea.spec.ts",
            "libs/parent/filea.ts",
            "libs/parent/project.json",
            "libs/parent/src/index.ts",
            "nx.json",
            "tsconfig.base.json",
          ],
          "runtime": [],
        },
        "value": "1325637283470296766",
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

  it('should use child task hash as proxy when dependentTasksOutputFiles is **/*', async () => {
    const nxJsonWithDepsOutputs: NxJsonConfiguration = {
      namedInputs: {
        default: ['{projectRoot}/**/*'],
      },
      targetDefaults: {
        build: {
          cache: true,
          dependsOn: ['^build'],
          inputs: [
            'default',
            { dependentTasksOutputFiles: '**/*', transitive: false },
          ],
        },
      },
    };
    tempFs.writeFile('nx.json', JSON.stringify(nxJsonWithDepsOutputs));

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
            outputs: ['{projectRoot}/dist'],
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
            outputs: ['{projectRoot}/dist'],
          },
        },
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

    // Pre-set the child task's hash to simulate it already being computed
    taskGraph.tasks['child:build'].hash = 'precomputed-child-hash-123';

    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJsonWithDepsOutputs,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph.tasks['parent:build'], taskGraph, {});

    // The hash details should contain a TaskHash entry for the child task
    // formatted as "child:build:precomputed-child-hash-123"
    const detailKeys = Object.keys(hash.details);
    const taskHashKey = detailKeys.find((k) =>
      k.includes('child:build:precomputed-child-hash-123')
    );
    expect(taskHashKey).toBeDefined();
    // Should NOT contain a TaskOutput entry for the child's outputs
    const taskOutputKey = detailKeys.find(
      (k) => k.includes('**/*:') && k.includes('libs/child')
    );
    expect(taskOutputKey).toBeUndefined();
  });

  it('should produce different hashes when child task hash changes with **/* depsOutputs', async () => {
    const nxJsonWithDepsOutputs: NxJsonConfiguration = {
      namedInputs: {
        default: ['{projectRoot}/**/*'],
      },
      targetDefaults: {
        build: {
          cache: true,
          dependsOn: ['^build'],
          inputs: [
            'default',
            { dependentTasksOutputFiles: '**/*', transitive: false },
          ],
        },
      },
    };
    tempFs.writeFile('nx.json', JSON.stringify(nxJsonWithDepsOutputs));

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
            outputs: ['{projectRoot}/dist'],
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
            outputs: ['{projectRoot}/dist'],
          },
        },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');

    const projectGraph = builder.getUpdatedProjectGraph();

    // Hash with first child hash
    const taskGraph1 = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    taskGraph1.tasks['child:build'].hash = 'child-hash-v1';

    const hash1 = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJsonWithDepsOutputs,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph1.tasks['parent:build'], taskGraph1, {});

    // Hash with different child hash
    const taskGraph2 = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );
    taskGraph2.tasks['child:build'].hash = 'child-hash-v2';

    const hash2 = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJsonWithDepsOutputs,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph2.tasks['parent:build'], taskGraph2, {});

    // Different child hashes should produce different parent hashes
    expect(hash1.value).not.toEqual(hash2.value);
  });

  it('should use child task hash transitively when dependentTasksOutputFiles is **/*', async () => {
    const nxJsonWithDepsOutputs: NxJsonConfiguration = {
      namedInputs: {
        default: ['{projectRoot}/**/*'],
      },
      targetDefaults: {
        build: {
          cache: true,
          dependsOn: ['^build'],
          inputs: [
            'default',
            { dependentTasksOutputFiles: '**/*', transitive: true },
          ],
        },
      },
    };
    tempFs.writeFile('nx.json', JSON.stringify(nxJsonWithDepsOutputs));

    await tempFs.createFiles({
      'libs/grandchild/src/index.ts': 'grandchild-content',
      'libs/grandchild/project.json': JSON.stringify({ name: 'grandchild' }),
    });

    const workspaceFiles = await retrieveWorkspaceFiles(tempFs.tempDir, {
      'libs/parent': 'parent',
      'libs/child': 'child',
      'libs/grandchild': 'grandchild',
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
            outputs: ['{projectRoot}/dist'],
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
            outputs: ['{projectRoot}/dist'],
          },
        },
      },
    });
    builder.addNode({
      name: 'grandchild',
      type: 'lib',
      data: {
        root: 'libs/grandchild',
        targets: {
          build: {
            executor: 'nx:run-commands',
            outputs: ['{projectRoot}/dist'],
          },
        },
      },
    });
    builder.addStaticDependency('parent', 'child', 'libs/parent/filea.ts');
    builder.addStaticDependency('child', 'grandchild', 'libs/child/fileb.ts');

    const projectGraph = builder.getUpdatedProjectGraph();
    const taskGraph = createTaskGraph(
      projectGraph,
      { build: ['^build'] },
      ['parent'],
      ['build'],
      undefined,
      {}
    );

    // Pre-set hashes for both child and grandchild tasks
    taskGraph.tasks['child:build'].hash = 'child-hash-abc';
    taskGraph.tasks['grandchild:build'].hash = 'grandchild-hash-xyz';

    const hash = await new NativeTaskHasherImpl(
      tempFs.tempDir,
      nxJsonWithDepsOutputs,
      projectGraph,
      workspaceFiles.rustReferences,
      { selectivelyHashTsConfig: false }
    ).hashTask(taskGraph.tasks['parent:build'], taskGraph, {});

    // Should include TaskHash entries for both child and grandchild
    const detailKeys = Object.keys(hash.details);
    const childHashKey = detailKeys.find((k) =>
      k.includes('child:build:child-hash-abc')
    );
    const grandchildHashKey = detailKeys.find((k) =>
      k.includes('grandchild:build:grandchild-hash-xyz')
    );
    expect(childHashKey).toBeDefined();
    expect(grandchildHashKey).toBeDefined();
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
