import defaultTasksRunner from './default-tasks-runner';

describe('defaultTasksRunner', () => {
  it('should set pocess.env.NX_LOAD_DOT_ENV_FILES to "false" if runner option "loadDotEnvFiles" is false', async () => {
    const tasks = [];
    const options = {
      loadDotEnvFiles: false,
      lifeCycle: { startCommand: () => {}, endCommand: () => {} },
    };
    const context: any = {};
    process.env.NX_LOAD_DOT_ENV_FILES = 'true';
    expect(process.env.NX_LOAD_DOT_ENV_FILES).toBe('true');
    await defaultTasksRunner(tasks, options, context);
    expect(process.env.NX_LOAD_DOT_ENV_FILES).toBe('false');
  });

  it('should leave pocess.env.NX_LOAD_DOT_ENV_FILES as-is if runner option "loadDotEnvFiles" is not false', async () => {
    const tasks = [];
    const options = {
      loadDotEnvFiles: true,
      lifeCycle: { startCommand: () => {}, endCommand: () => {} },
    };
    const context: any = {};
    process.env.NX_LOAD_DOT_ENV_FILES = 'true';
    expect(process.env.NX_LOAD_DOT_ENV_FILES).toBe('true');
    await defaultTasksRunner(tasks, options, context);
    expect(process.env.NX_LOAD_DOT_ENV_FILES).toBe('true');
  });
});
