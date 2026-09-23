import { writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NoTargetsToMigrateError } from '@nx/devkit/internal';
import { convertToInferred } from '../../generators/convert-to-inferred/convert-to-inferred';
import migrate from './convert-to-inferred';

jest.mock('../../generators/convert-to-inferred/convert-to-inferred');

const convert = jest.mocked(convertToInferred);

describe('convert Remix executors migration', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns the converter callback so migration warnings are flushed', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const callback = jest.fn();
    convert.mockResolvedValue(callback);

    expect(await migrate(tree)).toBe(callback);
    expect(convert).toHaveBeenCalledWith(tree, {});
  });

  it('skips workspaces without legacy executor targets', async () => {
    convert.mockRejectedValue(new NoTargetsToMigrateError());

    await expect(
      migrate(createTreeWithEmptyWorkspace())
    ).resolves.toBeUndefined();
  });

  it('skips instead of aborting the migration batch on an unsupported Remix version', async () => {
    const tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      name: 'test',
      dependencies: { '@remix-run/dev': '^1.19.0' },
    });

    await expect(migrate(tree)).resolves.toBeUndefined();
    expect(convert).not.toHaveBeenCalled();
  });

  it('does not hide conversion failures', async () => {
    const error = new Error('Unable to load Remix config');
    convert.mockRejectedValue(error);

    await expect(migrate(createTreeWithEmptyWorkspace())).rejects.toBe(error);
  });
});
