import { getDocument } from './documents.api';

describe('getDocument', () => {
  it('should retrieve documents that exist', () => {
    const result = getDocument('latest', [
      'react',
      'getting-started',
      'getting-started',
    ]);

    expect(result.filePath).toBeTruthy();
  });

  it('should throw error if segments do not match a file', () => {
    expect(() =>
      getDocument('latest', ['this', 'does', 'not', 'exist'])
    ).toThrow();
  });
});
