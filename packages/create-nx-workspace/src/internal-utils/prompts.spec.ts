import { determineTemplate } from './prompts';

jest.mock('../utils/ci/is-ci', () => ({
  isCI: jest.fn(() => false),
}));

jest.mock('../utils/git/git', () => ({
  isGitAvailable: jest.fn(() => true),
}));

describe('determineTemplate', () => {
  describe('non-interactive mode', () => {
    it('should return nrwl/empty-template when no preset or template is provided', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
      });
      expect(result).toBe('nrwl/empty-template');
    });

    it('should return the provided template when --template is set', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
        template: 'nrwl/react-template',
      });
      expect(result).toBe('nrwl/react-template');
    });

    it('should return custom when --preset is set', async () => {
      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: false,
        preset: 'react-monorepo',
      });
      expect(result).toBe('custom');
    });
  });

  describe('CI mode', () => {
    it('should return nrwl/empty-template in CI without preset or template', async () => {
      const { isCI } = require('../utils/ci/is-ci');
      (isCI as jest.Mock).mockReturnValueOnce(true);

      const result = await determineTemplate({
        _: [],
        $0: '',
        interactive: true,
      });
      expect(result).toBe('nrwl/empty-template');
    });
  });
});
