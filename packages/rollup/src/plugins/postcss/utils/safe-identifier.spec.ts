import { safeIdentifier, escapeClassNameDashes } from './safe-identifier';

describe('escapeClassNameDashes', () => {
  it('should convert dashes to camelCase', () => {
    expect(escapeClassNameDashes('my-class')).toBe('myClass');
  });

  it('should handle multiple dashes', () => {
    expect(escapeClassNameDashes('my-very-long-class')).toBe('myVeryLongClass');
  });

  it('should handle consecutive dashes', () => {
    expect(escapeClassNameDashes('my--class')).toBe('myClass');
  });

  it('should not modify names without dashes', () => {
    expect(escapeClassNameDashes('myClass')).toBe('myClass');
  });
});

describe('safeIdentifier', () => {
  it('should convert dashes to camelCase', () => {
    expect(safeIdentifier('my-class')).toBe('myClass');
  });

  it('should prefix with underscore if starts with digit', () => {
    expect(safeIdentifier('123class')).toBe('_123class');
  });

  it('should prefix reserved words with underscore', () => {
    expect(safeIdentifier('class')).toBe('_class');
    expect(safeIdentifier('export')).toBe('_export');
    expect(safeIdentifier('import')).toBe('_import');
    expect(safeIdentifier('default')).toBe('_default');
  });

  it('should replace invalid characters with underscores', () => {
    expect(safeIdentifier('my.class')).toBe('my_class');
    expect(safeIdentifier('my@class')).toBe('my_class');
  });

  it('should handle complex class names', () => {
    // -123 becomes 123 (dash removal with next char capitalized, but 1 stays as 1)
    expect(safeIdentifier('my-class-123')).toBe('myClass123');
  });

  it('should not modify valid identifiers', () => {
    expect(safeIdentifier('myClass')).toBe('myClass');
    expect(safeIdentifier('_private')).toBe('_private');
    expect(safeIdentifier('$special')).toBe('$special');
  });
});
