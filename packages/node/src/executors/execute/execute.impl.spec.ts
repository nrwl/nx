let buildOptions;

jest.mock('@nrwl/devkit');

const devkit = require('@nrwl/devkit');
import { ExecutorContext, logger } from '@nrwl/devkit';

jest.mock('child_process');
let { fork } = require('child_process');
jest.mock('tree-kill');
let treeKill = require('tree-kill');

import {
  executeExecutor,
  InspectType,
  NodeExecuteBuilderOptions,
} from './execute.impl';

describe('NodeExecuteBuilder', () => {
  let testOptions: NodeExecuteBuilderOptions;
  let context: ExecutorContext;
  let mockSubProcess: { on: jest.Mock, exitCode: number };

  beforeEach(async () => {
    buildOptions = {};

    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true, outfile: 'outfile.js' };
    });

    (devkit.readTargetOptions as any).mockImplementation(() => buildOptions);

    (devkit.parseTargetString as any).mockImplementation(
      jest.requireActual('@nrwl/devkit').parseTargetString
    );

    fork.mockImplementation(() => {
      mockSubProcess = {
        on: jest.fn().mockImplementation((eventName, cb) => {
          if (eventName === 'exit') {
            mockSubProcess.exitCode = 0;
            cb(mockSubProcess.exitCode);
          }
        }),
        exitCode: null
      };
      return mockSubProcess;
    });

    treeKill.mockImplementation((pid, signal, callback) => {
      callback();
    });
    context = {
      root: '/root',
      cwd: '/root',
      workspace: {
        version: 2,
        projects: {
          nodeapp: {
            root: '/root/nodeapp',
            targets: {
              build: {
                executor: 'build',
                options: {},
              },
            },
          },
        },
      },
      isVerbose: false,
    };
    testOptions = {
      inspect: true,
      args: [],
      runtimeArgs: [],
      buildTarget: 'nodeapp:build',
      port: 9229,
      waitUntilTargets: [],
      host: 'localhost',
      watch: true,
      emitSubprocessEvents: false
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should build the application and start the built file', async () => {
    for await (const event of executeExecutor(testOptions, context)) {
      if(!("success" in event)) throw new Error("Got Unexpected event")
      expect(event.success).toEqual(true);
    }
    expect(require('@nrwl/devkit').runExecutor).toHaveBeenCalledWith(
      {
        project: 'nodeapp',
        target: 'build',
      },
      {
        watch: true,
      },
      context
    );
    expect(fork).toHaveBeenCalledWith('outfile.js', [], {
      execArgv: [
        '-r',
        'source-map-support/register',
        '--inspect=localhost:9229',
      ],
    });
    expect(treeKill).toHaveBeenCalledTimes(0);
    expect(fork).toHaveBeenCalledTimes(1);
  });
  describe('--inspect', () => {
    describe('inspect', () => {
      it('should inspect the process', async () => {
        for await (const event of executeExecutor(
          {
            ...testOptions,
            inspect: InspectType.Inspect,
          },
          context
        )) {}
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229',
          ],
        });
      });
    });

    describe('inspect-brk', () => {
      it('should inspect and break at beginning of execution', async () => {
        for await (const event of executeExecutor(
          {
            ...testOptions,
            inspect: InspectType.InspectBrk,
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect-brk=localhost:9229',
          ],
        });
      });
    });
  });

  describe('--host', () => {
    describe('0.0.0.0', () => {
      it('should inspect the process on host 0.0.0.0', async () => {
        for await (const event of executeExecutor(
          {
            ...testOptions,
            host: '0.0.0.0',
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=0.0.0.0:9229',
          ],
        });
      });
    });
  });

  describe('--port', () => {
    describe('1234', () => {
      it('should inspect the process on port 1234', async () => {
        for await (const event of executeExecutor(
          {
            ...testOptions,
            port: 1234,
          },
          context
        )) {
        }
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:1234',
          ],
        });
      });
    });
  });

  describe('--runtimeArgs', () => {
    it('should add runtime args to the node process', async () => {
      for await (const event of executeExecutor(
        {
          ...testOptions,
          runtimeArgs: ['-r', 'node-register'],
        },
        context
      )) {
      }
      expect(fork).toHaveBeenCalledWith('outfile.js', [], {
        execArgv: [
          '-r',
          'source-map-support/register',
          '-r',
          'node-register',
          '--inspect=localhost:9229',
        ],
      });
    });
  });

  it('should log errors from killing the process', async () => {
    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true, outfile: 'outfile.js' };
      yield { success: true, outfile: 'outfile.js' };
    });
    treeKill.mockImplementation((pid, signal, callback) => {
      callback(new Error('Error Message'));
    });

    const loggerError = jest.spyOn(logger, 'error');

    for await (const event of executeExecutor(testOptions, context)) {
    }
    expect(loggerError).toHaveBeenCalledWith('Error Message');
  });

  it('should log errors from killing the process on windows', async () => {
    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true, outfile: 'outfile.js' };
      yield { success: true, outfile: 'outfile.js' };
    });
    treeKill.mockImplementation((pid, signal, callback) => {
      callback([new Error('error'), '', 'Error Message']);
    });

    const loggerError = jest.spyOn(logger, 'error');

    for await (const event of executeExecutor(
      {
        ...testOptions,
        runtimeArgs: ['-r', 'node-register'],
      },
      context
    )) {
    }
    expect(loggerError).toHaveBeenLastCalledWith('Error Message');
  });

  it('should build the application and start the built file with options', async () => {
    for await (const event of executeExecutor(
      {
        ...testOptions,
        inspect: false,
        args: ['arg1', 'arg2'],
      },
      context
    )) {
    }
    expect(fork).toHaveBeenCalledWith('outfile.js', ['arg1', 'arg2'], {
      execArgv: ['-r', 'source-map-support/register'],
    });
  });

  it('should warn users who try to use it in production', async () => {
    buildOptions = {
      optimization: true,
    };
    const loggerWarn = jest.spyOn(logger, 'warn');
    for await (const event of executeExecutor(
      {
        ...testOptions,
        inspect: false,
        args: ['arg1', 'arg2'],
      },
      context
    )) {
    }
    expect(loggerWarn).toHaveBeenCalled();
  });

  describe('waitUntilTasks', () => {
    it('should run the tasks before starting the build', async () => {
      const runExecutor = require('@nrwl/devkit').runExecutor;
      for await (const event of executeExecutor(
        {
          ...testOptions,
          waitUntilTargets: ['project1:target1', 'project2:target2'],
        },
        context
      )) {
      }

      expect(runExecutor).toHaveBeenCalledTimes(3);
      expect(runExecutor).toHaveBeenNthCalledWith(
        1,
        {
          project: 'project1',
          target: 'target1',
        },
        {},
        context
      );
      expect(runExecutor).toHaveBeenCalledWith(
        {
          project: 'project2',
          target: 'target2',
        },
        {},
        context
      );
    });

    it('should not run the build if any of the tasks fail', async () => {
      devkit.runExecutor.mockImplementation(function* () {
        yield { success: false };
      });

      try {
        for await (const event of executeExecutor(
          {
            ...testOptions,
            waitUntilTargets: ['project1:target1', 'project2:target2'],
          },
          context
        )) {
        }
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(
          `"Wait until target failed: project1:target1."`
        );
      }
    });
  });

  describe('--watch', () => {
    let mockSubProcessExit;
    let mockSubProcessMessage;
    let mockSubProcessError;

    beforeEach(() => {
      fork.mockImplementation(() => {
        mockSubProcess = {
          on: jest.fn().mockImplementation((eventName, cb) => {
            if(eventName === 'exit'){
              mockSubProcessExit = (exitCode: number) => {
                cb(exitCode);
                mockSubProcess.exitCode = exitCode;
              };
            }

            if(eventName === 'error'){
              mockSubProcessError = cb;
            }

            if(eventName === "message"){
              mockSubProcessMessage = cb;
            }
          }),
          exitCode: null
        };

        return mockSubProcess;
      });
    })

    describe('false', () => {
      it('Should not complete until the child process has exited', async () => {
        const firstEvent = Symbol('first');
        const secondEvent = Symbol('second');
        const events = [];
        const executorIterator = executeExecutor(
            {
              ...testOptions,
              watch: false,
            },
            context
        );

        expect(await executorIterator.next()).toEqual(({
          done: false,
          value: {
            outfile: 'outfile.js',
            success: true
          }
        }));

        const result = await Promise.race([
            executorIterator.next(),
            new Promise(() => {
              mockSubProcessExit(1);
              events.push(firstEvent);
            })
        ])

        events.push(secondEvent);

        expect(result).toEqual({
          value: undefined,
          done: true
        });
        expect(events).toEqual([firstEvent, secondEvent]);
      });

      it("When sub process emits, it should propagate when configured", async () => {
        const expectedExitCode = 42;
        const executorIterator = executeExecutor(
            {
              ...testOptions,
              watch: false,
              emitSubprocessEvents: true
            },
            context
        );

        expect(await executorIterator.next()).toEqual(({
          done: false,
          value: {
            outfile: 'outfile.js',
            success: true
          }
        }));

        mockSubProcessExit(expectedExitCode);

        expect(await executorIterator.next()).toEqual(({
          done: false,
          value: {
            exitCode: expectedExitCode
          }
        }));
      });

      it("Should propagate sub process events in expected order", async () => {
        const expectedSubProcessEvents = [
          {
            message: "hello"
          },
          {
            message: 'world'
          },
          {
            error: new Error("error")
          },
          {
            exitCode: 1
          }
        ];
        const expectedTotalEvents = 5;

        let subProcessEvents = [];
        let totalEvents = 0;

        const doSubProcessWork = () => {
          mockSubProcessMessage("hello");
          mockSubProcessMessage("world");
          mockSubProcessError(new Error("error"));
          mockSubProcessExit(1)
        }

        for await(const event of executeExecutor(
            {
              ...testOptions,
              watch: false,
              emitSubprocessEvents: true
            },
            context
        )){
          if(totalEvents === 0){
            expect(event).toEqual({
              outfile: 'outfile.js',
              success: true
            });
            doSubProcessWork();
          } else {
            subProcessEvents.push(event);
          }

          totalEvents += 1;
        }

        expect(subProcessEvents).toEqual(expectedSubProcessEvents);
        expect(totalEvents).toEqual(expectedTotalEvents)
      });
    });

    describe("true", () => {
      beforeEach(() => {
        (devkit.runExecutor as any).mockImplementation(async function* () {
          yield { success: true, outfile: 'outfile.js' };
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          yield { success: true, outfile: 'outfile.js' };
        });
      });

      it("Should not block build events with process events", async () => {
        const executorIterator = executeExecutor(
            {
              ...testOptions,
              watch: true,
            },
            context
        );

        expect(await executorIterator.next()).toEqual({
          done: false,
          value: {
            outfile: "outfile.js",
            success: true
          }
        });

        // sub process has not exited yet, but we'll receive a new build event

        expect(await executorIterator.next()).toEqual({
          done: false,
          value: {
            outfile: "outfile.js",
            success: true
          }
        });

        // there's no more build events, but process still needs to exit

        const result = await Promise.race([
            executorIterator.next(),
            new Promise(() => {
              mockSubProcessExit()
            })
        ]);

        expect(result).toEqual({
          value: undefined,
          done: true
        })
      });

      it("Yield build and process events cooperatively", async () => {
        const events = [];
        for await(const event of executeExecutor(
            {
              ...testOptions,
              watch: true,
              emitSubprocessEvents: true
            },
            context
        )){
          if('outfile' in event){
            mockSubProcessExit(1)
          }

          events.push(event)
        }

        expect(events).toHaveLength(4)
      });
    })
  });
});
