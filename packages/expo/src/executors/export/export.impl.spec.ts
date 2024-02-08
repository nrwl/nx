import { createExportOptions } from './export.impl';

describe('createExportOptions', () => {
  it('should not pass --dev if dev is false', () => {
    const options = createExportOptions({ dev: false }, '');
    expect(options).toEqual([]);
  });

  it('should pass --dev if dev is true', () => {
    const options = createExportOptions({ dev: true }, '');
    expect(options).toEqual(['--dev']);
  });

  it('should pass --output-dir with offset to workspace root', () => {
    const options = createExportOptions({ outputDir: 'dist' }, 'apps/app');
    expect(options).toEqual(['--output-dir', '../../dist']);
  });
});
