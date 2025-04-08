import { assertValidStyle, assertValidReactRouter } from './assertion';

describe('assertValidStyle', () => {
  it('should accept style option values from app, lib, component schematics', () => {
    const schemas = [
      require('../generators/application/schema.json'),
      require('../generators/component/schema.json'),
      require('../generators/library/schema.json'),
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

  it('should throw for invalid react-router and bundler combination', () => {
    expect(() => assertValidReactRouter(true, 'webpack')).toThrow(
      /Unsupported/
    );
    expect(() => assertValidReactRouter(true, 'rspack')).toThrow(/Unsupported/);
    expect(() => assertValidReactRouter(true, 'rsbuild')).toThrow(
      /Unsupported/
    );
    expect(() => assertValidReactRouter(true, 'vite')).not.toThrow(
      /Unsupported/
    );
  });
});
