import {
  NxCypressE2EPresetOptions,
  nxE2EPreset,
} from '@nx/cypress/plugins/cypress-preset';

export function nxE2EStorybookPreset(
  filePath: string,
  options?: NxCypressE2EPresetOptions
) {
  return {
    ...nxE2EPreset(filePath, options),
    baseUrl: 'http://localhost:4400',
  };
}
