import path = require('path');
import json = require('./migrations.json');

describe('Node migrations', () => {
  it('should have valid paths', () => {
    Object.values(json.generators).forEach((m) => {
      expect(() =>
        require.resolve(path.join(__dirname, `${m.factory}.ts`))
      ).not.toThrow();
    });
  });
});
