import path = require('path');
import json = require('./migrations.json');

describe('Cypress migrations', () => {
  it('should have valid paths', () => {
    Object.values((json as any)?.schematics || {}).forEach((m: any) => {
      expect(() =>
        require.resolve(path.join(__dirname, `${m.factory}.ts`))
      ).not.toThrow();
    });
  });
});
