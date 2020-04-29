import { assertValidStyle } from './assertion';

describe('assertValidStyle', () => {
  it('should accept style option values from app, lib, component schematics', () => {
    const schemas = [
      require('../schematics/application/schema.json'),
      require('../schematics/component/schema.json'),
      require('../schematics/library/schema.json'),
    ];

    schemas.forEach((schema) => {
      const values = schema.properties.style['x-prompt'].items;
      expect(() =>
        values.forEach((value) => assertValidStyle(value)).not.toThrow()
      );
    });
  });

  it('should throw for invalid values', () => {
    expect(() => assertValidStyle('bad')).toThrow(/Unsupported/);
  });
});
