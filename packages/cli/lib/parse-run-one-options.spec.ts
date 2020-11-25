import { parseRunOneOptions } from './parse-run-one-options';

describe('parseRunOneOptions', () => {
  const workspaceJson = { projects: { myproj: { architect: { build: {} } } } };
  const args = ['build', 'myproj', '--configuration=production', '--flag=true'];

  it('should work', () => {
    expect(parseRunOneOptions(workspaceJson, args)).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should work with --prod', () => {
    expect(
      parseRunOneOptions(workspaceJson, [
        'build',
        'myproj',
        '--prod',
        '--flag=true',
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should override --prod with --configuration', () => {
    expect(
      parseRunOneOptions(workspaceJson, [
        'build',
        'myproj',
        '--prod',
        '--configuration',
        'dev',
        '--flag=true',
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'dev',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should work with run syntax', () => {
    expect(
      parseRunOneOptions(workspaceJson, [
        'run',
        'myproj:build:production',
        '--flag=true',
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should use defaultProjectName when no provided', () => {
    expect(
      parseRunOneOptions(
        { ...workspaceJson, cli: { defaultProjectName: 'myproj' } },
        ['build', '--flag=true']
      )
    ).toEqual({
      project: 'myproj',
      target: 'build',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should return false when the task is not recognized', () => {
    expect(parseRunOneOptions({}, args)).toBe(false);
    expect(parseRunOneOptions({ projects: {} }, args)).toBe(false);
    expect(parseRunOneOptions({ projects: { architect: {} } }, args)).toBe(
      false
    );
  });

  it('should return false when cannot find the right project', () => {
    expect(parseRunOneOptions(workspaceJson, ['build', 'wrongproj'])).toBe(
      false
    );
  });

  it('should return false when no project specified', () => {
    expect(parseRunOneOptions(workspaceJson, ['build'])).toBe(false);
  });
});
