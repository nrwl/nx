import {
  CreateMetadataError,
  ProjectGraphError,
} from '../project-graph/error-types';
import { handleErrors } from './handle-errors';
import { output } from './output';
import { MinReleaseAgeViolationError } from './min-release-age/errors';

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
    // --verbose is active, so we should see the stack trace
    expect(body).toMatch(/\s+at.*handle-errors.spec.ts/);
  });

  it('should not display stack trace if not verbose', async () => {
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
    expect(body).toContain('cause message');
    expect(body).not.toMatch(/\s+at.*handle-errors.spec.ts/);
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

  it('surfaces minimum-release-age remediation as body lines', async () => {
    const spy = jest.spyOn(output, 'error').mockImplementation(() => {});
    await handleErrors(false, async () => {
      throw new MinReleaseAgeViolationError({
        packageManager: 'npm',
        packageName: 'pkg',
        spec: 'latest',
        pmShapedDetail:
          'No matching version found for pkg@latest with a date before 2020.',
        blocked: [],
        remediation: [
          'Wait until a matching version is older than the window.',
        ],
      });
    });
    const { title, bodyLines } = spy.mock.calls[0][0];
    expect(title).toContain('No matching version');
    expect(bodyLines).toEqual([
      'Wait until a matching version is older than the window.',
    ]);
  });
});
