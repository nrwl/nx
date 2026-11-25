import type { Task } from '../config/task-graph';
import {
  findInvocationLoop,
  getInvocationAncestors,
  serializeInvocationAncestors,
} from './invocation-ancestors';

function task(id: string, overrides: Record<string, unknown> = {}): Task {
  const [project, target] = id.split(':');
  return {
    id,
    target: { project, target },
    overrides,
    outputs: [],
    projectRoot: `libs/${project}`,
  } as unknown as Task;
}

// The ancestors a nested Nx process sees when `tasks` started it, one hop per
// entry, outermost first.
function ancestorsOf(...hops: Task[][]) {
  for (const hop of hops) {
    process.env.NX_INVOCATION_ANCESTORS = serializeInvocationAncestors(hop);
  }
  return getInvocationAncestors();
}

describe('invocation ancestors', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_INVOCATION_ANCESTORS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should not report a loop in a root invocation', () => {
    expect(findInvocationLoop(task('a:build'), ancestorsOf())).toBeNull();
  });

  it('should report a task that re-runs an ancestor task', () => {
    const ancestors = ancestorsOf([task('a:build')], [task('b:build')]);

    expect(findInvocationLoop(task('a:build'), ancestors)).toEqual([
      'a:build',
      'b:build',
    ]);
  });

  it('should allow a task its ancestor process runs beside the spawning task', () => {
    // `nx run-many -t slow,nested` runs a:slow and b:nested side by side, and
    // b:nested runs a:slow again in a nested Nx process.
    const ancestors = ancestorsOf([task('b:nested')]);

    expect(findInvocationLoop(task('a:slow'), ancestors)).toBeNull();
  });

  it('should count every task of a batch ancestor', () => {
    const ancestors = ancestorsOf([task('a:build'), task('b:build')]);

    expect(findInvocationLoop(task('b:build'), ancestors)).not.toBeNull();
  });

  it('should allow one re-run of an ancestor task with different overrides', () => {
    const ancestors = ancestorsOf([task('a:build')]);

    expect(
      findInvocationLoop(task('a:build', { flag: true }), ancestors)
    ).toBeNull();
  });

  it('should report a task whose overrides change on every hop', () => {
    const ancestors = ancestorsOf(
      [task('a:build')],
      [task('a:build', { depth: 1 })]
    );

    expect(
      findInvocationLoop(task('a:build', { depth: 2 }), ancestors)
    ).not.toBeNull();
  });

  it('should treat a malformed NX_INVOCATION_ANCESTORS as a root invocation', () => {
    process.env.NX_INVOCATION_ANCESTORS = '123,456';
    expect(getInvocationAncestors()).toEqual([]);

    process.env.NX_INVOCATION_ANCESTORS = JSON.stringify([
      { pid: 123, taskId: 'a:build' },
    ]);
    expect(getInvocationAncestors()).toEqual([]);
  });
});
