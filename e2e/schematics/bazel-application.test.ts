import {checkFilesExist, newApp, newBazelProject, newLib, runCLI, updateFile} from '../utils';

xdescribe('Nrwl Workspace (Bazel)', () => {
  it(
    'should work',
    () => {
      newBazelProject();
      newApp('myApp --directory=myDir');
      newLib('myLib --directory=myDir');

      checkFilesExist('WORKSPACE', 'BUILD.bazel');
    },
    1000000
  );
});
