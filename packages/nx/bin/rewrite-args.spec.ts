import { rewriteTargetsAndProjects } from './init-local';

describe('rewriteTargetsAndProjects', () => {
  it('should rewrite projects, exclude and targets', () => {
    const res = rewriteTargetsAndProjects([
      'node',
      'nx',
      'run-many',
      '--before',
      '-p',
      'one',
      'two',
      '--exclude',
      'one',
      'two',
      '-t',
      'test',
      'lint',
      '--ci',
      '--',
      'some-arg',
    ]);
    expect(res).toEqual([
      'run-many',
      '--before',
      '-p',
      'one,two',
      '--exclude',
      'one,two',
      '-t',
      'test,lint',
      '--ci',
      '--',
      'some-arg',
    ]);
  });
});
