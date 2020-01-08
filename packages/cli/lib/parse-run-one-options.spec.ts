import { parseRunOneOptions } from './parse-run-one-options';

describe('parseRunOneOptions', () => {
  const nxJson = { tasksRunnerOptions: { default: { runner: 'somerunner' } } };
  const workspaceJson = { projects: { myproj: { architect: { build: {} } } } };
  const args = ['build', 'myproj', '--configuration=production', '--flag=true'];

  it('should work', () => {
    expect(parseRunOneOptions(nxJson, workspaceJson, args)).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      overrides: { flag: 'true' }
    });
  });

  it('should work with run syntax', () => {
    expect(
      parseRunOneOptions(nxJson, workspaceJson, [
        'run',
        'myproj:build:production',
        '--flag=true'
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      overrides: { flag: 'true' }
    });
  });

  it('should use defaultProjectName when no provided', () => {
    expect(
      parseRunOneOptions(
        nxJson,
        { ...workspaceJson, cli: { defaultProjectName: 'myproj' } },
        ['build', '--flag=true']
      )
    ).toEqual({
      project: 'myproj',
      target: 'build',
      overrides: { flag: 'true' }
    });
  });

  it('should return false when no runner is set', () => {
    expect(parseRunOneOptions({}, workspaceJson, args)).toBe(false);
    expect(
      parseRunOneOptions({ tasksRunnerOptions: {} }, workspaceJson, args)
    ).toBe(false);
    expect(
      parseRunOneOptions(
        { tasksRunnerOptions: { default: {} } },
        workspaceJson,
        args
      )
    ).toBe(false);
  });

  it('should return false when the task is not recognized', () => {
    expect(parseRunOneOptions(nxJson, {}, args)).toBe(false);
    expect(parseRunOneOptions(nxJson, { projects: {} }, args)).toBe(false);
    expect(
      parseRunOneOptions(nxJson, { projects: { architect: {} } }, args)
    ).toBe(false);
  });

  it('should return false when cannot find the right project', () => {
    expect(
      parseRunOneOptions(nxJson, workspaceJson, ['build', 'wrongproj'])
    ).toBe(false);
  });

  it('should return false when no project specified', () => {
    expect(parseRunOneOptions(nxJson, workspaceJson, ['build'])).toBe(false);
  });
});
