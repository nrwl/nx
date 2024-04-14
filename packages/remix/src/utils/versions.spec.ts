import { getBunlderType } from './versions';
import { rmSync, rmdirSync, writeFileSync } from 'fs';
import { mkdirsSync } from 'fs-extra';

describe.only('bunlder type inference', () => {
  // Can not use tree for executor testing (tree is not available in executors)
  beforeEach(() => {
    // clean up just in case
    rmSync('tmptest', { recursive: true, force: true });
    mkdirsSync('tmptest');
  });

  afterAll(() => {
    rmSync('tmptest', { recursive: true, force: true });
  });

  it('infers vite configuration', () => {
    writeFileSync('tmptest/vite.config.ts', '');
    expect(getBunlderType('tmptest')).toBe('vite');
  });

  it('infers vite configuration', () => {
    expect(getBunlderType('tmptest')).toBe('classic');
  });
});
