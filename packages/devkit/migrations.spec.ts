import path = require('path');
import json = require('./migrations.json');

const migrations = Object.entries(json.generators);

describe('devkit migrations', () => {
  it.each(migrations)('should have valid path: %s', (key, m) => {
    expect(() =>
      require.resolve(path.join(__dirname, `${m.factory}.ts`))
    ).not.toThrow();
  });
});
