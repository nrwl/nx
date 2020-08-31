jest.mock('glob', () => ({
  sync: jest.fn().mockImplementation((file) => file),
}));

jest.mock('path', () => ({
  join: (...paths) => paths.join('/'),
  normalize: (path) => path,
  relative: (...paths) => paths[1],
}));

const { sync } = require('glob');
const { getFilesToLint } = require('./file-utils');
describe('file-utility', () => {
  it('should process and return the list of files if specified', () => {
    const files = ['file1', 'file2'];
    const exclude = ['file2'];
    const toLint = getFilesToLint('/root', { files, exclude });
    expect(sync).toHaveBeenNthCalledWith(1, 'file1', {
      cwd: '/root',
      ignore: ['file2'],
      nodir: true,
    });
    expect(sync).toHaveBeenNthCalledWith(2, 'file2', {
      cwd: '/root',
      ignore: ['file2'],
      nodir: true,
    });
    expect(toLint).toEqual(['/root/file1', '/root/file2']);
  });
  it('should return empty if no files or program', () => {
    const files = [];
    const toLint = getFilesToLint('/root', { files });
    expect(toLint).toEqual([]);
  });
  it('should get the proper file names from a program', () => {
    const sourceFiles = [
      { fileName: 'foo.ts', isFromExternalLib: false },
      { fileName: 'foo.d.ts', isFromExternalLib: false },
      { fileName: 'foo.json', isFromExternalLib: false },
      { fileName: 'bar.d.ts', isFromExternalLib: true },
      { fileName: 'bar.ts', isFromExternalLib: true },
      { fileName: 'bar.ts', isFromExternalLib: false },
    ];
    const program = {
      getSourceFiles: () => sourceFiles,
      isSourceFileFromExternalLibrary: (file: any) => file.isFromExternalLib,
    };
    const toLint = getFilesToLint('/root', {}, program);
    expect(toLint).toEqual(['foo.ts', 'foo.d.ts', 'bar.ts']);
  });
  it('should filter out the excluded files from the program', () => {
    const sourceFiles = [
      { fileName: 'foo.ts' },
      { fileName: 'bar.spec.ts' },
      { fileName: 'bar.ts' },
    ];
    const exclude = ['*.spec.ts'];
    const program = {
      getSourceFiles: () => sourceFiles,
      isSourceFileFromExternalLibrary: () => false,
    };
    const toLint = getFilesToLint('/root', { exclude }, program);
    expect(toLint).toEqual(['foo.ts', 'bar.ts']);
  });
});
