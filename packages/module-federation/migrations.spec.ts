import path = require('path');
import json = require('./migrations.json');

type MigrationGenerator = {
  cli: string;
  version: string;
  description: string;
  factory: string;
};

describe('Module Federation migrations', () => {
  it('should have valid paths', () => {
    Object.values<MigrationGenerator>(json.generators).forEach((m) => {
      expect(() =>
        require.resolve(path.join(__dirname, `${m.factory}.ts`))
      ).not.toThrow();
    });
  });
});
