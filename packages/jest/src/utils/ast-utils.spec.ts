import { addTransformerToConfig } from './ast-utils';
describe('Jest AST Utils', () => {
  describe('addTransformerToConfig', () => {
    it('should add transformer to module.exports config', () => {
      const actual = addTransformerToConfig(
        `module.exports = {
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  displayName: 'blah',
  preset: '../../jest.preset.js'
};`,
        `'^.+\\\\.[tj]sx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.spec.json'}]`
      );

      expect(actual).toMatchSnapshot();
    });

    it('should add transformer to export default config', () => {
      const actual = addTransformerToConfig(
        `export default {
  transform: {
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  displayName: 'blah',
  preset: '../../jest.preset.js'
};`,
        `'^.+\\\\.[tj]sx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.spec.json'}]`
      );

      expect(actual).toMatchSnapshot();
    });

    it('should add transformer to module.exports config with no transform object', () => {
      const actual = addTransformerToConfig(
        `module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  displayName: 'blah',
  preset: '../../jest.preset.js'
};`,
        `'^.+\\\\.[tj]sx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.spec.json'}]`
      );

      expect(actual).toMatchSnapshot();
    });

    it('should add transformer to export default config with no transform object', () => {
      const actual = addTransformerToConfig(
        `export default {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  displayName: 'blah',
  preset: '../../jest.preset.js'
};`,
        `'^.+\\\\.[tj]sx?$': ['ts-jest', {tsconfig: '<rootDir>/tsconfig.spec.json'}]`
      );

      expect(actual).toMatchSnapshot();
    });
  });
});
