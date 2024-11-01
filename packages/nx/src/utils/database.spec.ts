import { databaseSupportEnabled } from './database';

describe('test if database is enabled', () => {
  it('should be disabled by default', () => {
    process.env.NX_DISABLE_DB = undefined;
    expect(databaseSupportEnabled()).toBe(false);
  });
  it('should be disabled if NX_DISABLE_DB is explicitly set to `true`', () => {
    process.env.NX_DISABLE_DB = 'true';
    expect(databaseSupportEnabled()).toBe(false);
  });
  it('should be enabled if NX_DISABLE_DB is explicitly set to `false`', () => {
    process.env.NX_DISABLE_DB = 'false';
    expect(databaseSupportEnabled()).toBe(true);
  });
});
