import path = require('path');
import json = require('./migrations.json');
import { MigrationsJsonEntry } from 'nx/src/config/misc-interfaces';

describe('Jest migrations', () => {
  it('should have valid paths', () => {
    Object.values(json.generators).forEach((m: MigrationsJsonEntry) => {
      expect(() =>
        require.resolve(
          path.join(__dirname, `${m.factory ?? m.implementation}.ts`)
        )
      ).not.toThrow();
    });
  });
});
