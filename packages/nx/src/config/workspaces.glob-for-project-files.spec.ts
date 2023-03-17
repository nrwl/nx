import { TempFs } from '../utils/testing/temp-fs';
import { globForProjectFiles } from './workspaces';

describe('globForProjectFiles', () => {
  let fs: TempFs;
  beforeAll(() => {
    fs = new TempFs('glob-for-project-files');
  });
  afterAll(() => {
    fs.cleanup();
  });

  it('should not find files that are listed by .nxignore', async () => {
    await fs.createFile('.nxignore', `not-projects`);
    await fs.createFile(
      'not-projects/project.json',
      JSON.stringify({
        name: 'not-project-1',
      })
    );
    await fs.createFile(
      'projects/project.json',
      JSON.stringify({
        name: 'project-1',
      })
    );
    expect(globForProjectFiles(fs.tempDir, [])).not.toContain(
      'not-projects/project.json'
    );
    expect(globForProjectFiles(fs.tempDir, [])).toContain(
      'projects/project.json'
    );
  });
});
