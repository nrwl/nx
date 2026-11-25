import { launchEditor } from './launch-editor';

describe('launchEditor', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // `GIT_EDITOR` wins over `core.editor` and the other variables, so the
    // result does not depend on the machine's git config
    process.env.GIT_EDITOR = 'nx-release-editor-that-does-not-exist';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should reject instead of crashing when the editor cannot be launched', async () => {
    const error = await launchEditor('message.md').then(
      () => {
        throw new Error('expected launchEditor to reject');
      },
      (e: Error) => e
    );

    expect(error.message).toContain(
      'Could not launch the editor "nx-release-editor-that-does-not-exist"'
    );
    expect(error.message).toContain('ENOENT');
    expect(error.message).toContain('GIT_EDITOR or EDITOR');
  });
});
