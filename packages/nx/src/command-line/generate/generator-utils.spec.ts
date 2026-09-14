import { join } from 'node:path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { getImplementationFactory } from '../../config/schema-utils';
import { getGeneratorInformation } from './generator-utils';

vi.mock('../../config/schema-utils', () => ({
  getImplementationFactory: vi.fn(() => () => ({})),
  resolveSchema: vi.fn((schema: string, directory: string) =>
    join(directory, schema)
  ),
}));

describe('getGeneratorInformation', () => {
  it('reads an inherited generator from the collection that declares it', () => {
    const fs = new TempFs('generator-utils-extends');
    fs.createFilesSync({
      'child/generators.json': JSON.stringify({
        generators: {},
        extends: [join(fs.tempDir, 'parent/generators.json')],
      }),
      'parent/generators.json': JSON.stringify({
        generators: { gen: { factory: './gen', schema: './schema.json' } },
      }),
      'parent/schema.json': JSON.stringify({ properties: {} }),
    });
    const child = join(fs.tempDir, 'child/generators.json');
    const parent = join(fs.tempDir, 'parent/generators.json');

    const info = getGeneratorInformation(child, 'gen', fs.tempDir, {});

    expect(info.resolvedCollectionName).toBe(parent);
    expect(vi.mocked(getImplementationFactory)).toHaveBeenCalledWith(
      './gen',
      join(fs.tempDir, 'parent'),
      child,
      {},
      parent
    );
    fs.cleanup();
  });
});
