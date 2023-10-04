import { collapseExpandedOutputs } from './collapse-expanded-outputs';

describe('collapseExpandedOutputs', () => {
  it('should handle no outputs', async () => {
    const outputs = [];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual([]);
  });

  it('should keep files as is', async () => {
    const outputs = ['dist/apps/app1/0.js'];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['dist/apps/app1/0.js']);
  });

  it('should keep directories as is', async () => {
    const outputs = ['dist/apps/app1'];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['dist/apps/app1']);
  });

  it('should keep short lists of directories as is', async () => {
    const outputs = ['test-results/apps/app1', 'coverage/apps/app1'];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['test-results/apps/app1', 'coverage/apps/app1']);
  });

  it('should keep short lists of files as is', async () => {
    const outputs = [
      'test-results/apps/app1/results.xml',
      'coverage/apps/app1/coverage.html',
    ];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual([
      'test-results/apps/app1/results.xml',
      'coverage/apps/app1/coverage.html',
    ]);
  });

  it('should collapse long lists of directories', async () => {
    const outputs = [
      'dist/apps/app1/a',
      'dist/apps/app1/b',
      'dist/apps/app1/c',
      'dist/apps/app1/d',
    ];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['dist/apps/app1']);
  });

  it('should collapse long lists of directories + files', async () => {
    const outputs = [
      'coverage/apps/app1',
      'dist/apps/app1/a.txt',
      'dist/apps/app1/b.txt',
      'dist/apps/app1/c.txt',
      'dist/apps/app1/d.txt',
    ];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['coverage/apps/app1', 'dist/apps/app1']);
  });

  it('should keep long lists of top-level directories', async () => {
    const outputs = ['a', 'b', 'c', 'd', 'e', 'f'];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('should collapse long lists of files', async () => {
    const outputs = [
      'dist/apps/app1/a.js',
      'dist/apps/app1/b.js',
      'dist/apps/app1/c.js',
      'dist/apps/app1/d.js',
    ];
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['dist/apps/app1']);
  });

  it('should collapse long lists of files in nested directories', async () => {
    const outputs = [];
    // Create dist/apps/app1/n/m.js + dist/apps/app1/n/m.d.ts
    for (let i = 0; i < 6; i++) {
      outputs.push(`dist/apps/app1/${i}.js`);
      outputs.push(`dist/apps/app1/${i}.d.ts`);
      for (let j = 0; j < 6; j++) {
        outputs.push(`dist/apps/app1/${i}/${j}.js`);
        outputs.push(`dist/apps/app1/${i}/${j}.d.ts`);
      }
    }
    const res = collapseExpandedOutputs(outputs);

    expect(res).toEqual(['dist/apps/app1']);
  });
});
