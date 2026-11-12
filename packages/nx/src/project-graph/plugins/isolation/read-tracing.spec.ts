import { quoteWindowsArg } from './read-tracing';

describe('quoteWindowsArg', () => {
  it.each([
    ['plain', 'plain'],
    ['C:\\Program Files\\node.exe', '"C:\\Program Files\\node.exe"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['trailing\\ slash\\', '"trailing\\ slash\\\\"'],
    ['a\\"b', '"a\\\\\\"b"'],
    ['', '""'],
  ])('should quote %j so CommandLineToArgvW reads it back', (arg, quoted) => {
    expect(quoteWindowsArg(arg)).toBe(quoted);
  });
});
