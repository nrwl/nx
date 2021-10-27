import path = require('path');
import json = require('./migrations.json');

describe('Storybook migrations', () => {
  it('should have valid paths', () => {
    Object.values(json.schematics).forEach((m) => {
      expect(() =>
        require.resolve(path.join(__dirname, `${m.factory}.ts`))
      ).not.toThrow();
    });
  });
});
