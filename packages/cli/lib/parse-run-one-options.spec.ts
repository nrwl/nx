import { parseRunOneOptions } from './parse-run-one-options';

describe('parseRunOneOptions', () => {
  const workspaceJson = {
    projects: {
      myproj: {
        architect: { build: { defaultConfiguration: 'someDefaultConfig' } },
      },
    },
  };
  const nxJson = {};
  const args = ['build', 'myproj', '--configuration=production', '--flag=true'];

  it('should work', () => {
    expect(parseRunOneOptions('root', workspaceJson, nxJson, args)).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'production',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should work with --prod', () => {
    expect(
      parseRunOneOptions('root', workspaceJson, nxJson, [
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
      parseRunOneOptions('root', workspaceJson, nxJson, [
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
      parseRunOneOptions('root', workspaceJson, nxJson, [
        'run',
        'myproj:build:staging',
        '--flag=true',
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'staging',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should use defaultProjectName when no provided', () => {
    expect(
      parseRunOneOptions(
        'root',
        { ...workspaceJson },
        { cli: { defaultProjectName: 'myproj' } },
        ['build', '--flag=true']
      )
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'someDefaultConfig',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should use defaultConfiguration when no provided', () => {
    expect(
      parseRunOneOptions('root', workspaceJson, nxJson, [
        'run',
        'myproj:build',
        '--flag=true',
      ])
    ).toEqual({
      project: 'myproj',
      target: 'build',
      configuration: 'someDefaultConfig',
      parsedArgs: { _: [], flag: 'true' },
    });
  });

  it('should return false when the task is not recognized', () => {
    expect(parseRunOneOptions('root', {}, nxJson, args)).toBe(false);
    expect(parseRunOneOptions('root', { projects: {} }, nxJson, args)).toBe(
      false
    );
    expect(
      parseRunOneOptions('root', { projects: { architect: {} } }, nxJson, args)
    ).toBe(false);
  });

  it('should return false when cannot find the right project', () => {
    expect(
      parseRunOneOptions('root', workspaceJson, nxJson, ['build', 'wrongproj'])
    ).toBe(false);
  });

  it('should return false when no project specified', () => {
    expect(parseRunOneOptions('root', workspaceJson, nxJson, ['build'])).toBe(
      false
    );
  });
});
