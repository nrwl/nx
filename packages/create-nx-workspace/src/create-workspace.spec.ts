import {
  extractConnectUrl,
  resolveTemplateShorthand,
} from './create-workspace';

describe('extractConnectUrl', () => {
  test('should extract the correct URL from the given string', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://staging.nx.app/connect/O8dfB0jYgvd
        `;
    const expectedUrl = 'https://staging.nx.app/connect/O8dfB0jYgvd';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });

  test('should return null if no URL is present', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        No URL here.
        `;
    expect(extractConnectUrl(inputString)).toBeNull();
  });

  test('should handle URLs with different domains and paths', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://example.com/connect/abcd1234
        `;
    const expectedUrl = 'https://example.com/connect/abcd1234';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });

  test('should handle URLs with query parameters and fragments', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://example.com/connect/abcd1234?query=param#fragment
        `;
    const expectedUrl =
      'https://example.com/connect/abcd1234?query=param#fragment';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });
});

describe('resolveTemplateShorthand', () => {
  test('should resolve angular shorthand', () => {
    expect(resolveTemplateShorthand('angular')).toBe('nrwl/angular-template');
  });

  test('should resolve react shorthand', () => {
    expect(resolveTemplateShorthand('react')).toBe('nrwl/react-template');
  });

  test('should resolve typescript shorthand', () => {
    expect(resolveTemplateShorthand('typescript')).toBe(
      'nrwl/typescript-template'
    );
  });

  test('should resolve empty shorthand', () => {
    expect(resolveTemplateShorthand('empty')).toBe('nrwl/empty-template');
  });

  test('should pass through full template names unchanged', () => {
    expect(resolveTemplateShorthand('nrwl/angular-template')).toBe(
      'nrwl/angular-template'
    );
  });

  test('should pass through unknown values unchanged', () => {
    expect(resolveTemplateShorthand('nrwl/custom-template')).toBe(
      'nrwl/custom-template'
    );
  });
});
