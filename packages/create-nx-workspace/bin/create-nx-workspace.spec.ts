import { validateWorkspaceName } from './create-nx-workspace';

// Mock the output module and process.exit
jest.mock('../src/utils/output', () => ({
  output: {
    error: jest.fn(),
  },
}));

jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('validateWorkspaceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow names starting with a letter', () => {
    expect(() => validateWorkspaceName('myapp')).not.toThrow();
    expect(() => validateWorkspaceName('MyApp')).not.toThrow();
    expect(() => validateWorkspaceName('my-app')).not.toThrow();
    expect(() => validateWorkspaceName('my_app')).not.toThrow();
    expect(() => validateWorkspaceName('app123')).not.toThrow();
  });

  it('should reject names starting with a number', () => {
    expect(() => validateWorkspaceName('4name')).toThrow('process.exit called');
    expect(() => validateWorkspaceName('123app')).toThrow(
      'process.exit called'
    );
    expect(() => validateWorkspaceName('0test')).toThrow('process.exit called');
  });

  it('should reject names starting with special characters', () => {
    expect(() => validateWorkspaceName('-app')).toThrow('process.exit called');
    expect(() => validateWorkspaceName('_app')).toThrow('process.exit called');
    expect(() => validateWorkspaceName('@app')).toThrow('process.exit called');
  });

  it('should call output.error with correct message for invalid names', () => {
    const { output } = require('../src/utils/output');

    try {
      validateWorkspaceName('4name');
    } catch (e) {
      // Expected to throw
    }

    expect(output.error).toHaveBeenCalledWith({
      title: 'Invalid workspace name',
      bodyLines: [
        'The workspace name "4name" is invalid.',
        'Workspace names must start with a letter.',
        'Examples of valid names: myapp, MyApp, my-app, my_app',
      ],
    });
  });
});
