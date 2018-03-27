import { checkFilesExist, createNxWorkspace, readJson } from '../utils';

/**
 * Too slow to run on CI :(
 */
xdescribe('CreateNxWorkspace', () => {
  it(
    'should create a new workspace using npm',
    () => {
      const res = createNxWorkspace('proj --npmScope=myscope');
      expect(res).toContain("Project 'proj' successfully created.");

      const config = readJson('.angular-cli.json');
      expect(config.project.name).toEqual('proj');
      expect(config.project.npmScope).toEqual('myscope');

      checkFilesExist('package-lock.json');
    },
    1000000
  );

  it(
    'should create a new workspace using yarn',
    () => {
      const res = createNxWorkspace('proj --npmScope=myscope --yarn');
      expect(res).toContain("Project 'proj' successfully created.");

      const config = readJson('.angular-cli.json');
      expect(config.project.name).toEqual('proj');
      expect(config.project.npmScope).toEqual('myscope');

      checkFilesExist('yarn.lock');
    },
    1000000
  );

  it(
    'should create a new workspace with the --directory option',
    () => {
      const res = createNxWorkspace(
        'myproj --npmScope=myscope --directory=proj'
      );
      expect(res).toContain("Project 'myproj' successfully created.");
      checkFilesExist('package-lock.json');
    },
    1000000
  );

  it(
    'should error when no name is given',
    () => {
      expect(() => createNxWorkspace('')).toThrowError(
        'Please provide a project name'
      );
    },
    1000000
  );
});
