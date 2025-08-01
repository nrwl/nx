import { normalizeContent } from './feed-answer';

jest.mock('@nx/nx-dev-ui-primitives', () => {
  return {
    cx: jest.fn(() => null),
  };
});

describe('FeedAnswer', () => {
  describe('normalizeContent', () => {
    it('should normalize links to format expected by renderMarkdown', () => {
      expect(
        normalizeContent(`[!](https://nx.dev/shared/assets/image.png)`)
      ).toEqual(`[!](/shared/assets/image.png)`);
    });

    it('should escape numbers the beginning of lines to prevent numbered lists', () => {
      expect(
        normalizeContent(`
1. Hello
2. World
`)
      ).toEqual(`
1\\. Hello
2\\. World
`);
    });
  });
});
