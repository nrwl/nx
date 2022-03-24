import { CypressConfigTransformer } from './change-config-transformer';

describe('Update Cypress Config', () => {
  const defaultConfigContent = `
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nrwl/react/plugins/component-testing';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';


export default defineConfig({
  component: nxComponentTestingPreset(__dirname),
  e2e: nxE2EPreset(__dirname),
})`;

  const configWithSpread = `
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nrwl/react/plugins/component-testing';
import { nxE2EPreset } from '@nrwl/cypress/plugins/cypress-preset';


export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__dirname),
    video: false,
    screenshotsFolder: '../blah/another/value'
  }
  e2e: {
    ...nxE2EPreset(__dirname),
    video: false,
    screenshotsFolder: '../blah/another/value'
  }
})`;

  const expandedConfigContent = `
import { defineConfig } from 'cypress';
import { componentDevServer } from '@nrwl/cypress/plugins/next';


export default defineConfig({
  baseUrl: 'blah its me',
  component: {
    devServer: componentDevServer('tsconfig.cy.json', 'babel'),
    video: true,
    chromeWebSecurity: false,
    fixturesFolder: 'cypress/fixtures',
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
    videosFolder: '../../dist/cypress/apps/n/videos',
    screenshotsFolder: '../../dist/cypress/apps/n/screenshots',
  },
  e2e: {
    fileServerFolder: '.',
    fixturesFolder: './src/fixtures',
    integrationFolder: './src/e2e',
    supportFile: './src/support/e2e.ts',
    specPattern: '**/*.cy.{js,ts}',
    video: true,
    videosFolder: '../../dist/cypress/apps/myapp4299814-e2e/videos',
    screenshotsFolder: '../../dist/cypress/apps/myapp4299814-e2e/screenshots',
    chromeWebSecurity: false,
  }
});
  `;

  it('should add and update existing properties', () => {
    const actual = CypressConfigTransformer.addOrUpdateProperties(
      expandedConfigContent,
      {
        blah: 'i am a top level property',
        baseUrl: 'http://localhost:1234',
        component: {
          fixturesFolder: 'cypress/fixtures/cool',
          devServer: { tsConfig: 'tsconfig.spec.json', compiler: 'swc' },
          // @ts-ignore
          blah: 'i am a random property',
        },
        e2e: {
          video: false,
        },
      }
    );

    expect(actual).toMatchSnapshot();
  });

  it('should overwrite existing config', () => {
    const actual = CypressConfigTransformer.addOrUpdateProperties(
      expandedConfigContent,
      {
        baseUrl: 'http://overwrite:8080',
        component: {
          devServer: { tsConfig: 'tsconfig.spec.json', compiler: 'swc' },
        },
        e2e: {
          video: false,
        },
      },
      true
    );

    expect(actual).toMatchSnapshot();
  });

  it('should remove properties', () => {
    const actual = CypressConfigTransformer.removeProperties(
      expandedConfigContent,
      [
        'baseUrl',
        'component.devServer',
        'component.specPattern',
        'component.video',
        'e2e.chromeWebSecurity',
        'e2e.screenshotsFolder',
        'e2e.video',
      ]
    );
    expect(actual).toMatchSnapshot();
  });

  it('should add property to default config', () => {
    const actual = CypressConfigTransformer.addOrUpdateProperties(
      defaultConfigContent,
      {
        e2e: {
          baseUrl: 'http://localhost:1234',
        },
        component: {
          video: false,
        },
      }
    );

    expect(actual).toMatchSnapshot();
  });

  it('should add property with spread config', () => {
    const actual = CypressConfigTransformer.addOrUpdateProperties(
      configWithSpread,
      {
        e2e: {
          baseUrl: 'http://localhost:1234',
        },
        component: {
          defaultCommandTimeout: 60000,
        },
      }
    );

    expect(actual).toMatchSnapshot();
  });

  it('should delete a property with spread config', () => {
    const actual = CypressConfigTransformer.removeProperties(configWithSpread, [
      'component.defaultCommandTimeout',
      'component.screenshotsFolder',
      'e2e.baseUrl',
      'e2e.video',
    ]);

    expect(actual).toMatchSnapshot();
  });

  it('should not change the default config with removal', () => {
    // default config is a direct assignment vs object expression so there is nothing to remove.
    const actual = CypressConfigTransformer.removeProperties(
      defaultConfigContent,
      [
        'component.screenshotsFolder',
        'component.video',
        'e2e.screenshotsFolder',
        'e2e.video',
      ]
    );

    expect(actual).toMatchSnapshot();
  });
});
