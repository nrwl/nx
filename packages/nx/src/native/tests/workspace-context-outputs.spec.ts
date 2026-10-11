import { WorkspaceContext } from '../index';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { cacheDirectoryForWorkspace } from '../../utils/cache-directory';

describe('WorkspaceContext outputs tracking', () => {
  let fs: TempFs;
  let context: WorkspaceContext;

  beforeEach(async () => {
    fs = new TempFs('workspace-context-outputs');
    await fs.createFiles({
      'dist/app/main.js': 'main',
      'dist/app/readme.md': 'readme',
    });
    context = new WorkspaceContext(
      fs.tempDir,
      cacheDirectoryForWorkspace(fs.tempDir)
    );
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('matches recorded outputs for their hash until they change', () => {
    context.recordOutputs([{ outputs: ['dist/app'], hash: 'h1' }]);

    expect(
      context.outputsUnchanged([
        { outputs: ['dist/app'], hash: 'h1' },
        { outputs: ['dist/app'], hash: 'h2' },
        { outputs: ['dist/other'], hash: 'h1' },
      ])
    ).toEqual([true, false, false]);

    fs.writeFile('dist/app/main.js', 'changed');
    expect(
      context.outputsUnchanged([{ outputs: ['dist/app'], hash: 'h1' }])
    ).toEqual([false]);
  });

  it('ignores files an output glob does not name', () => {
    const outputs = ['dist/**/*.js'];
    context.recordOutputs([{ outputs, hash: 'h1' }]);

    fs.writeFile('dist/app/notes.txt', 'unrelated');
    expect(context.outputsUnchanged([{ outputs, hash: 'h1' }])).toEqual([true]);
  });
});
