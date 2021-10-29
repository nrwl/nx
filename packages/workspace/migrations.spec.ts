import path = require('path');
import json = require('./migrations.json');

describe('Workspace migrations', () => {
  it('should have valid paths', () => {
    Object.values(json.schematics).forEach((m: any) => {
      expect(() =>
        require.resolve(
          path.join(__dirname, `${m.implementation || m.factory}.ts`)
        )
      ).not.toThrow();
    });
  });
});
