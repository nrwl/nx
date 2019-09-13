import { processArgs } from './affected';
import { NxJson } from './shared';
import defaultTasksRunner from '../tasks-runner/default-tasks-runner';
import { TasksRunner } from '../tasks-runner/tasks-runner';

describe('processArgs', () => {
  let nxJson: NxJson;
  let mockRunner: TasksRunner;

  beforeEach(() => {
    nxJson = {
      npmScope: 'proj',
      projects: {}
    };
    mockRunner = jest.fn();
  });

  it('should process nx specific arguments as affected args', () => {
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        nxJson
      ).affectedArgs
    ).toEqual({
      files: ['']
    });
  });

  it('should process non nx specific arguments as tasks runner args', () => {
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['--override'],
          $0: ''
        },
        nxJson
      ).tasksRunnerOptions
    ).toEqual({
      notNxArg: true
    });
  });

  it('should process delimited args as task overrides', () => {
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['', '--override'],
          $0: ''
        },
        nxJson
      ).taskOverrides
    ).toEqual({
      override: true
    });
  });

  it('should get a default tasks runner', () => {
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['', '--override'],
          $0: ''
        },
        nxJson
      ).tasksRunner
    ).toEqual(defaultTasksRunner);
  });

  it('should get a custom tasks runner', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true
    });
    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner'
      }
    };
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          runner: 'custom',
          _: ['', '--override'],
          $0: ''
        },
        nxJson
      ).tasksRunner
    ).toEqual(mockRunner);
  });

  it('should get a custom tasks runner with options', () => {
    jest.mock('custom-runner', () => mockRunner, {
      virtual: true
    });
    nxJson.tasksRunnerOptions = {
      custom: {
        runner: 'custom-runner',
        options: {
          runnerOption: 'runner-option'
        }
      }
    };
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          runner: 'custom',
          _: ['', '--override'],
          $0: ''
        },
        nxJson
      ).tasksRunnerOptions
    ).toEqual({
      runnerOption: 'runner-option',
      notNxArg: true
    });
  });

  it('should get a custom defined default tasks runner', () => {
    jest.mock('custom-default-runner', () => mockRunner, {
      virtual: true
    });
    nxJson.tasksRunnerOptions = {
      default: {
        runner: 'custom-default-runner'
      }
    };
    expect(
      processArgs(
        {
          files: [''],
          notNxArg: true,
          _: ['', '--override'],
          $0: ''
        },
        nxJson
      ).tasksRunner
    ).toEqual(mockRunner);
  });
});
