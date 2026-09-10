import { TempFs } from '../../internal-testing-utils/temp-fs';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { transformProjectGraphForRust } from '../transform-objects';
import {
  HashPlanner,
  TaskHasher,
  hashArray,
  testOnlyTransferFileMap,
  transferProjectGraph,
} from '../index';

describe('task hash result conversion and assembly', () => {
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('task-hash-results');
    await tempFs.createFiles({ 'config.json': '{"version":"1.0.0"}' });
  });

  afterEach(() => tempFs.cleanup());

  function fixture() {
    const builder = new ProjectGraphBuilder();
    // UTF-8 and UTF-16 sort these last two names differently.
    const packages = [
      ...Array.from({ length: 64 }, (_, i) => `dep-${i}`),
      'dep-\ue000',
      'dep-🤖',
    ];
    for (const [index, packageName] of packages.entries()) {
      builder.addExternalNode({
        name: `npm:${packageName}`,
        type: 'npm',
        data: { packageName, version: `1.0.${index}` },
      });
    }
    const projects = Array.from({ length: 40 }, (_, i) => `p${i}`);
    for (const name of projects) {
      builder.addNode({
        name,
        type: 'lib',
        data: {
          root: name,
          targets: {
            build: {
              executor: 'nx:run-commands',
              inputs: [
                { env: 'SELECTED_ENV' },
                { env: 'ENV-🤖' },
                { externalDependencies: packages },
                { json: '{workspaceRoot}/config.json', fields: ['version'] },
              ],
            },
          },
        },
      });
    }
    const graph = builder.getUpdatedProjectGraph();
    const tasks = createTaskGraph(
      graph,
      {},
      projects,
      ['build'],
      undefined,
      {}
    );
    const graphRef = transferProjectGraph(transformProjectGraphForRust(graph));
    const files = testOnlyTransferFileMap({}, [
      { file: 'config.json', hash: 'file-map-snapshot' },
    ]);
    const planner = new HashPlanner({}, graphRef);
    const hasher = new TaskHasher(
      tempFs.tempDir,
      graphRef,
      files.projectFiles,
      files.allWorkspaceFiles,
      Buffer.from('{}'),
      {},
      undefined,
      { selectivelyHashTsConfig: false }
    );
    const ids = Object.keys(tasks.tasks);
    const envs = Object.fromEntries(
      ids.map((id) => [id, { SELECTED_ENV: id, 'ENV-🤖': 'shared' }])
    );
    const hash = (selected: string[], collect: boolean, env = envs) =>
      hasher.hashPlans(
        planner.getPlansReference(selected, tasks),
        env,
        tempFs.tempDir,
        collect
      );
    return { ids, envs, hash };
  }

  it.each([false, true])(
    'preserves full results across batching and reused conversions (collect=%s)',
    (collect) => {
      const { ids, envs, hash } = fixture();
      const batch = hash(ids, collect);
      expect(Object.keys(batch).sort()).toEqual([...ids].sort());
      for (const id of ids) {
        const result = batch[id];
        const keys = Object.keys(result.details).sort((a, b) =>
          Buffer.compare(Buffer.from(a), Buffer.from(b))
        );
        // Independently reconstruct the existing hash format: UTF-8 ordered
        // keys, concatenated values, xxh3 over those bytes with no separator.
        expect(result.value).toBe(
          hashArray([keys.map((key) => result.details[key]).join('')])
        );
        expect(
          hashArray([
            Object.keys(result.details)
              .sort()
              .map((key) => result.details[key])
              .join(''),
          ])
        ).not.toBe(result.value);
        expect(keys).toContain('npm:dep-\ue000');
        expect(keys).toContain('npm:dep-🤖');
        expect(keys).toContain('env:ENV-🤖');
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(Object.getPrototypeOf(result.details)).toBe(Object.prototype);
        for (const key of keys) {
          expect(Object.getOwnPropertyDescriptor(result.details, key)).toEqual({
            value: result.details[key],
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
        expect(hash([id], collect)[id]).toEqual(result);
        Object.freeze(result.details);
      }
      expect(JSON.parse(JSON.stringify(batch))).toEqual(batch);
      expect(hash([...ids].reverse(), collect)).toEqual(batch);
      const changedEnvs = {
        ...envs,
        [ids[0]]: { ...envs[ids[0]], SELECTED_ENV: 'changed' },
      };
      const changed = hash(ids, collect, changedEnvs);
      expect(changed[ids[0]].value).not.toBe(batch[ids[0]].value);
      for (const id of ids.slice(1)) expect(changed[id]).toEqual(batch[id]);
      expect(hash(ids, collect)).toEqual(batch);
    }
  );

  it.each([false, true])(
    'refreshes live JSON inputs between calls (collect=%s)',
    async (collect) => {
      const { ids, hash } = fixture();
      const original = hash(ids, collect);
      if (collect)
        expect(original[ids[0]].inputs.files).toContain('config.json');
      await tempFs.createFiles({ 'config.json': '{"version":"2.0.0"}' });
      const changed = hash(ids, collect);
      for (const id of ids)
        expect(changed[id].value).not.toBe(original[id].value);
      await tempFs.createFiles({ 'config.json': '{"version":"1.0.0"}' });
      expect(hash(ids, collect)).toEqual(original);
    }
  );

  it('preserves empty selections and recovers after missing task environments', () => {
    const { ids, hash } = fixture();
    expect(hash([], false)).toEqual({});
    expect(hash([], true)).toEqual({});
    expect(() => hash([ids[0]], false, {})).toThrow(
      `hash_plans: missing env entry for task ${ids[0]}`
    );
    expect(hash(ids, false)).toEqual(hash([...ids].reverse(), false));
  });
});
