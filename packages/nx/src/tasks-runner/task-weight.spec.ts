import { Task } from '../config/task-graph';
import { getTaskWeight } from './task-weight';

function task(weight?: unknown): Task {
  return {
    id: 'proj:test',
    target: { project: 'proj', target: 'test' },
    overrides: {},
    outputs: [],
    cache: false,
    weight,
  } as Task;
}

describe('getTaskWeight', () => {
  it('defaults to 1 when unset', () => {
    expect(getTaskWeight(task(), 8)).toEqual(1);
  });

  it('uses the configured weight', () => {
    expect(getTaskWeight(task(3), 8)).toEqual(3);
  });

  it('caps the weight at the parallel limit', () => {
    expect(getTaskWeight(task(16), 8)).toEqual(8);
  });

  it.each([0, -2, 1.5, '4', null])('treats %p as 1', (weight) => {
    expect(getTaskWeight(task(weight), 8)).toEqual(1);
  });

  it('never returns less than 1 for a non-positive parallel limit', () => {
    expect(getTaskWeight(task(4), 0)).toEqual(1);
  });
});
