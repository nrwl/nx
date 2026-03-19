import { nxE2EPreset } from './preset';

describe(nxE2EPreset.name, () => {
  it('works without options', () => {
    const config = nxE2EPreset(__filename);
    expect(config.testDir).toBe('./src');
  });
});
