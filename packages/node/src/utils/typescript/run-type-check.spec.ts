import path = require('path');
import { runTypeCheck } from './run-type-check';

describe('runTypeCheck', () => {
  it('should find type errors', async () => {
    const result = await runTypeCheck(
      require('typescript'),
      path.join(__dirname, 'test-fixtures'),
      path.join(__dirname, 'test-fixtures'),
      path.join(__dirname, 'test-fixtures', 'tsconfig.json')
    );

    expect(result.errors).toHaveLength(2);
  });
});
