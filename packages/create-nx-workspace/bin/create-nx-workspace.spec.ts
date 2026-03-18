import { validateWorkspaceName } from './create-nx-workspace';
import { CnwError } from '../src/utils/error-utils';

describe('validateWorkspaceName', () => {
  it('should allow names starting with a letter', () => {
    expect(() => validateWorkspaceName('myapp')).not.toThrow();
    expect(() => validateWorkspaceName('MyApp')).not.toThrow();
    expect(() => validateWorkspaceName('my-app')).not.toThrow();
    expect(() => validateWorkspaceName('my_app')).not.toThrow();
    expect(() => validateWorkspaceName('app123')).not.toThrow();
  });

  it('should reject names starting with a number', () => {
    expect(() => validateWorkspaceName('4name')).toThrow(CnwError);
    expect(() => validateWorkspaceName('123app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('0test')).toThrow(CnwError);
  });

  it('should reject names starting with special characters', () => {
    expect(() => validateWorkspaceName('-app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('_app')).toThrow(CnwError);
    expect(() => validateWorkspaceName('@app')).toThrow(CnwError);
  });

  it('should throw CnwError with INVALID_WORKSPACE_NAME code', () => {
    try {
      validateWorkspaceName('4name');
      fail('Expected CnwError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CnwError);
      expect((e as CnwError).code).toBe('INVALID_WORKSPACE_NAME');
      expect((e as CnwError).message).toContain('4name');
      expect((e as CnwError).message).toContain(
        'Workspace names must start with a letter'
      );
    }
  });
});
