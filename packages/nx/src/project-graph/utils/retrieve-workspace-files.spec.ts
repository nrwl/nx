import { TempFs } from '../../utils/testing/temp-fs';
import { retrieveProjectConfigurationPaths } from './retrieve-workspace-files';

describe('retrieveProjectConfigurationPaths', () => {
  let fs: TempFs;
  beforeAll(() => {
    fs = new TempFs('retrieveProjectConfigurationPaths');
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
    expect(retrieveProjectConfigurationPaths(fs.tempDir, {})).not.toContain(
      'not-projects/project.json'
    );
    expect(retrieveProjectConfigurationPaths(fs.tempDir, {})).toContain(
      'projects/project.json'
    );
  });
});
