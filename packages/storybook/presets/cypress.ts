import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';

export function nxE2EStorybookPreset(filePath: string) {
  return {
    ...nxE2EPreset(filePath),
    baseUrl: 'http://localhost:4400',
  };
}
