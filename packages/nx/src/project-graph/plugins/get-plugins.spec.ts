import { createSerializableError } from '../../utils/serializable-error';
import { reasonToError } from './get-plugins';

describe('reasonToError', () => {
  it('should return the same Error instance when given a real Error', () => {
    const error = new Error('real error');
    const result = reasonToError(error);
    expect(result).toBe(error);
  });

  it('should extract message from a serialized error object', () => {
    const original = new Error('Cannot find module @repro/my-plugin/plugin');
    const serialized = createSerializableError(original);

    // Serialized errors are plain objects, not Error instances
    expect(serialized).not.toBeInstanceOf(Error);

    const result = reasonToError(serialized);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Cannot find module @repro/my-plugin/plugin');
    expect(result.stack).toBe(original.stack);
  });

  it('should handle a plain object with only a message property', () => {
    const result = reasonToError({ message: 'something went wrong' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something went wrong');
  });

  it('should fall back to String() for non-object reasons', () => {
    expect(reasonToError('string reason').message).toBe('string reason');
    expect(reasonToError(42).message).toBe('42');
    expect(reasonToError(null).message).toBe('null');
    expect(reasonToError(undefined).message).toBe('undefined');
  });
});
