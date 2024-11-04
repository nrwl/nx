import {
  CreateMetadataError,
  ProjectGraphError,
} from '../project-graph/error-types';
import { handleErrors } from './handle-errors';
import { output } from './output';

describe('handleErrors', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should display project graph error cause message', async () => {
    const spy = jest.spyOn(output, 'error').mockImplementation(() => {});
    await handleErrors(true, async () => {
      const cause = new Error('cause message');
      const metadataError = new CreateMetadataError(cause, 'test-plugin');
      throw new ProjectGraphError(
        [metadataError],
        { nodes: {}, dependencies: {} },
        {}
      );
    });
    const { bodyLines, title } = spy.mock.calls[0][0];
    const body = bodyLines.join('\n');
    expect(body).toContain('cause message');
    expect(body).toContain('test-plugin');
  });

  it('should only display wrapper error if not verbose', async () => {
    const spy = jest.spyOn(output, 'error').mockImplementation(() => {});
    await handleErrors(false, async () => {
      const cause = new Error('cause message');
      const metadataError = new CreateMetadataError(cause, 'test-plugin');
      throw new ProjectGraphError(
        [metadataError],
        { nodes: {}, dependencies: {} },
        {}
      );
    });

    const { bodyLines, title } = spy.mock.calls[0][0];
    const body = bodyLines.join('\n');
    expect(body).not.toContain('cause message');
  });

  it('should display misc errors that do not have a cause', async () => {
    const spy = jest.spyOn(output, 'error').mockImplementation(() => {});
    await handleErrors(true, async () => {
      throw new Error('misc error');
    });
    const { bodyLines, title } = spy.mock.calls[0][0];
    const body = bodyLines.join('\n');
    expect(body).toContain('misc error');
    expect(body).not.toMatch(/[Cc]ause/);
  });

  it('should display misc errors that have a cause', async () => {
    const spy = jest.spyOn(output, 'error').mockImplementation(() => {});
    await handleErrors(true, async () => {
      const cause = new Error('cause message');
      const err = new Error('misc error', { cause });
      throw err;
    });
    const { bodyLines, title } = spy.mock.calls[0][0];
    const body = bodyLines.join('\n');
    expect(body).toContain('misc error');
    expect(body).toContain('cause message');
  });
});
