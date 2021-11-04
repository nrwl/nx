import path = require('path');
import json = require('./migrations.json');

describe('JS migrations', () => {
  it('should have valid paths', () => {
    Object.values(json.generators).forEach((m: any) => {
      expect(() =>
        require.resolve(path.join(__dirname, `${m.factory}.ts`))
      ).not.toThrow();
    });
  });
});
