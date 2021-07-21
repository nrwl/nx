import { extractTitle } from './documents.utils';

describe('extractTitle', () => {
  it('should return header if it exists', () => {
    const content = `
  # This is the title
  
  Hello, this is just a test document...
  `;

    const result = extractTitle(content);

    expect(result).toEqual('This is the title');
  });

  it('should return null if title cannot be found', () => {
    const content = `
  ## Secondary header
  
  Hello, this is just a test document...
  `;

    const result = extractTitle(content);

    expect(result).toEqual(null);
  });
});
