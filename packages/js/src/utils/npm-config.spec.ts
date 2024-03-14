import { getNpmRegistry, getNpmTag } from './npm-config';

jest.mock('child_process', () => {
  const original = jest.requireActual('child_process');
  return {
    ...original,
    execSync: jest.fn().mockImplementation((command: string) => {
      switch (command) {
        case 'npm config get @scope:registry':
          return 'https://scoped-registry.com';
        case 'npm config get @missing:registry':
          return 'undefined';
        case 'npm config get registry':
          return 'https://custom-registry.com';
        case 'npm config get tag':
          return 'next';
        default:
          throw new Error(`unexpected command: ${command}`);
      }
    }),
  };
});

describe('npm-config', () => {
  const cwd = '/root';

  describe('getNpmRegistry', () => {
    it('should return scoped registry if it exists', () => {
      expect(getNpmRegistry('@scope/package', cwd)).toEqual(
        'https://scoped-registry.com'
      );
    });

    it('should return registry if scoped registry does not exist', () => {
      expect(getNpmRegistry('@missing/package', cwd)).toEqual(
        'https://custom-registry.com'
      );
    });

    it('should return registry if package is not scoped', () => {
      expect(getNpmRegistry('package', cwd)).toEqual(
        'https://custom-registry.com'
      );
    });
  });

  describe('getNpmTag', () => {
    it('should return tag', () => {
      expect(getNpmTag(cwd)).toEqual('next');
    });
  });
});
