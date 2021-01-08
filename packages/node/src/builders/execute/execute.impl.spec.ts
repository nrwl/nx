import {
  InspectType,
  NodeExecuteBuilderOptions,
  nodeExecuteBuilderHandler,
} from './execute.impl';
import { of, from } from 'rxjs';

import { MockBuilderContext } from '@nrwl/workspace/testing';

import { getMockContext } from '../../utils/testing';
import { bufferCount, first } from 'rxjs/operators';

jest.mock('child_process');
let { fork } = require('child_process');
jest.mock('tree-kill');
let treeKill = require('tree-kill');

describe('NodeExecuteBuilder', () => {
  let testOptions: NodeExecuteBuilderOptions;
  let context: MockBuilderContext;

  beforeEach(async () => {
    fork.mockImplementation(() => {
      return {
        on: (eventName, cb) => {
          if (eventName === 'exit') {
            cb();
          }
        },
      };
    });

    treeKill.mockImplementation((pid, signal, callback) => {
      callback();
    });
    context = await getMockContext();
    context.addTarget(
      {
        project: 'nodeapp',
        target: 'build',
      },
      '@nrwl/node:build'
    );
    testOptions = {
      inspect: true,
      args: [],
      runtimeArgs: [],
      buildTarget: 'nodeapp:build',
      port: 9229,
      waitUntilTargets: [],
      host: 'localhost',
      watch: true,
    };
  });

  it('should build the application and start the built file', async () => {
    spyOn(context, 'scheduleTarget').and.returnValue(
      of({
        output: of({ success: true, outfile: 'outfile.js' }),
        stop: () => Promise.resolve(),
      })
    );

    await nodeExecuteBuilderHandler(testOptions, context)
      .pipe(first())
      .toPromise();

    expect(context.scheduleTarget).toHaveBeenCalledWith(
      {
        project: 'nodeapp',
        target: 'build',
      },
      {
        watch: true,
      },
      undefined
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
        spyOn(context, 'scheduleTarget').and.returnValue(
          of({
            output: of({ success: true, outfile: 'outfile.js' }),
            stop: () => Promise.resolve(),
          })
        );

        await nodeExecuteBuilderHandler(
          {
            ...testOptions,
            inspect: InspectType.Inspect,
          },
          context
        )
          .pipe(first())
          .toPromise();

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
        spyOn(context, 'scheduleTarget').and.returnValue(
          of({
            output: of({ success: true, outfile: 'outfile.js' }),
            stop: () => Promise.resolve(),
          })
        );

        await nodeExecuteBuilderHandler(
          {
            ...testOptions,
            inspect: InspectType.InspectBrk,
          },
          context
        )
          .pipe(first())
          .toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229',
          ],
        });
      });
    });
  });

  describe('--host', () => {
    describe('0.0.0.0', () => {
      it('should inspect the process on host 0.0.0.0', async () => {
        spyOn(context, 'scheduleTarget').and.returnValue(
          of({
            output: of({ success: true, outfile: 'outfile.js' }),
            stop: () => Promise.resolve(),
          })
        );

        await nodeExecuteBuilderHandler(
          {
            ...testOptions,
            host: '0.0.0.0',
          },
          context
        )
          .pipe(first())
          .toPromise();
        expect(fork).toHaveBeenCalledWith('outfile.js', [], {
          execArgv: [
            '-r',
            'source-map-support/register',
            '--inspect=localhost:9229',
          ],
        });
      });
    });
  });

  describe('--port', () => {
    describe('1234', () => {
      it('should inspect the process on port 1234', async () => {
        spyOn(context, 'scheduleTarget').and.returnValue(
          of({
            output: of({ success: true, outfile: 'outfile.js' }),
            stop: () => Promise.resolve(),
          })
        );

        await nodeExecuteBuilderHandler(
          {
            ...testOptions,
            port: 1234,
          },
          context
        )
          .pipe(first())
          .toPromise();
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
      spyOn(context, 'scheduleTarget').and.returnValue(
        of({
          output: of({ success: true, outfile: 'outfile.js' }),
          stop: () => Promise.resolve(),
        })
      );

      await nodeExecuteBuilderHandler(
        {
          ...testOptions,
          runtimeArgs: ['-r', 'node-register'],
        },
        context
      )
        .pipe(first())
        .toPromise();
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

  it('should log errors from killing the process', async (done) => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback(new Error('Error Message'));
    });
    const loggerError = spyOn(context.logger, 'error');
    spyOn(context, 'scheduleTarget').and.returnValue(
      of({
        output: from([
          { success: true, outfile: 'outfile.js' },
          { success: true, outfile: 'outfile.js' },
        ]),
        stop: () => Promise.resolve(),
      })
    );
    nodeExecuteBuilderHandler(testOptions, context)
      .pipe(bufferCount(2))
      .subscribe(() => {
        expect(loggerError.calls.argsFor(0)).toEqual(['Error Message']);
        done();
      });
  });

  it('should log errors from killing the process on windows', (done) => {
    treeKill.mockImplementation((pid, signal, callback) => {
      callback([new Error('error'), '', 'Error Message']);
    });
    const loggerError = spyOn(context.logger, 'error');
    spyOn(context, 'scheduleTarget').and.returnValue(
      of({
        output: from([
          { success: true, outfile: 'outfile.js' },
          { success: true, outfile: 'outfile.js' },
        ]),
        stop: () => Promise.resolve(),
      })
    );
    nodeExecuteBuilderHandler(testOptions, context)
      .pipe(bufferCount(2))
      .subscribe(() => {
        expect(loggerError.calls.argsFor(0)).toEqual(['Error Message']);
        done();
      });
  });

  it('should build the application and start the built file with options', async () => {
    spyOn(context, 'scheduleTarget').and.returnValue(
      of({
        output: of({ success: true, outfile: 'outfile.js' }),
        stop: () => Promise.resolve(),
      })
    );

    await nodeExecuteBuilderHandler(
      {
        ...testOptions,
        inspect: false,
        args: ['arg1', 'arg2'],
      },
      context
    )
      .pipe(first())
      .toPromise();
    expect(fork).toHaveBeenCalledWith('outfile.js', ['arg1', 'arg2'], {
      execArgv: ['-r', 'source-map-support/register'],
    });
  });

  it('should warn users who try to use it in production', async () => {
    spyOn(context, 'scheduleTarget').and.returnValue(
      of({
        output: of({ success: true, outfile: 'outfile.js' }),
        stop: () => Promise.resolve(),
      })
    );

    spyOn(context, 'validateOptions').and.returnValue(
      Promise.resolve({
        optimization: true,
      })
    );
    spyOn(context.logger, 'warn');
    await nodeExecuteBuilderHandler(testOptions, context)
      .pipe(first())
      .toPromise();
    expect(context.logger.warn).toHaveBeenCalled();
  });

  describe('waitUntilTasks', () => {
    it('should run the tasks before starting the build', async () => {
      spyOn(context, 'scheduleTarget').and.returnValue(
        of({
          output: of({ success: true }),
          stop: () => Promise.resolve(),
        })
      );
      await nodeExecuteBuilderHandler(
        {
          ...testOptions,
          waitUntilTargets: ['project1:target1', 'project2:target2'],
        },
        context
      )
        .pipe(first())
        .toPromise();

      expect(context.scheduleTarget).toHaveBeenCalledTimes(3);
      expect(context.scheduleTarget).toHaveBeenCalledWith(
        {
          project: 'project1',
          target: 'target1',
        },
        undefined,
        undefined
      );
      expect(context.scheduleTarget).toHaveBeenCalledWith(
        {
          project: 'project2',
          target: 'target2',
        },
        undefined,
        undefined
      );
    });

    it('should not run the build if any of the tasks fail', async () => {
      spyOn(context, 'scheduleTarget').and.callFake((target) =>
        of({
          output: of({ success: target.target === 'project1' }),
          stop: () => Promise.resolve(),
        })
      );
      const loggerError = spyOn(context.logger, 'error');

      const output = await nodeExecuteBuilderHandler(
        {
          ...testOptions,
          waitUntilTargets: ['project1:target1', 'project2:target2'],
        },
        context
      )
        .pipe(first())
        .toPromise();
      expect(output).toEqual(
        jasmine.objectContaining({
          success: false,
        })
      );
      expect(loggerError).toHaveBeenCalled();
    });
  });
});
