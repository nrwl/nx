import { mkdirSync, writeFileSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { writeExecutorOutput } from './outputs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('writeExecutorOutput', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates the project-scoped output directory and writes the value', () => {
    writeExecutorOutput('app', 'imageid', 'sha256:abc');

    expect(mkdirSync).toHaveBeenCalledWith(
      `${workspaceDataDirectory}/docker-build/app`,
      { recursive: true }
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      `${workspaceDataDirectory}/docker-build/app/imageid`,
      'sha256:abc'
    );
  });
});
