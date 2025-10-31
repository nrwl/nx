import { handleRunPreTasksExecution, handleRunPostTasksExecution } from './handle-tasks-execution-hooks';
import type { PreTasksExecutionContext, PostTasksExecutionContext } from '../../project-graph/plugins/public-api';

// Mock the tasks-execution-hooks module
jest.mock('../../project-graph/plugins/tasks-execution-hooks', () => ({
  runPreTasksExecution: jest.fn(),
  runPostTasksExecution: jest.fn(),
}));

import { runPreTasksExecution, runPostTasksExecution } from '../../project-graph/plugins/tasks-execution-hooks';

describe('Task Execution Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRunPreTasksExecution', () => {
    it('should pass argv from context to runPreTasksExecution', async () => {
      const testArgv = ['node', 'nx', 'build', 'my-app'];
      const context: PreTasksExecutionContext = {
        id: 'test-id',
        workspaceRoot: '/test/workspace',
        nxJsonConfiguration: {},
        argv: testArgv,
      };

      (runPreTasksExecution as jest.Mock).mockResolvedValue([]);

      await handleRunPreTasksExecution(context);

      expect(runPreTasksExecution).toHaveBeenCalledWith(context);
      expect(runPreTasksExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: testArgv,
        })
      );
    });

    it('should handle different argv patterns (affected command)', async () => {
      const testArgv = ['node', 'nx', 'affected', '-t', 'build'];
      const context: PreTasksExecutionContext = {
        id: 'test-id-2',
        workspaceRoot: '/test/workspace',
        nxJsonConfiguration: {},
        argv: testArgv,
      };

      (runPreTasksExecution as jest.Mock).mockResolvedValue([]);

      await handleRunPreTasksExecution(context);

      expect(runPreTasksExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: testArgv,
        })
      );
    });
  });

  describe('handleRunPostTasksExecution', () => {
    it('should pass argv from context to runPostTasksExecution', async () => {
      const testArgv = ['node', 'nx', 'build', 'my-app'];
      const context: PostTasksExecutionContext = {
        id: 'test-id',
        workspaceRoot: '/test/workspace',
        nxJsonConfiguration: {},
        argv: testArgv,
        taskResults: {},
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      };

      (runPostTasksExecution as jest.Mock).mockResolvedValue(undefined);

      await handleRunPostTasksExecution(context);

      expect(runPostTasksExecution).toHaveBeenCalledWith(context);
      expect(runPostTasksExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: testArgv,
        })
      );
    });

    it('should handle different argv patterns (affected command)', async () => {
      const testArgv = ['node', 'nx', 'affected', '-t', 'test'];
      const context: PostTasksExecutionContext = {
        id: 'test-id-2',
        workspaceRoot: '/test/workspace',
        nxJsonConfiguration: {},
        argv: testArgv,
        taskResults: {},
        startTime: Date.now(),
        endTime: Date.now() + 1000,
      };

      (runPostTasksExecution as jest.Mock).mockResolvedValue(undefined);

      await handleRunPostTasksExecution(context);

      expect(runPostTasksExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          argv: testArgv,
        })
      );
    });
  });
});
