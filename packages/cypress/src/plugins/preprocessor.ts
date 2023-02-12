import { stripIndents } from '@nrwl/devkit';

/*
 * Keeping this file here, so users who still use the old preprocessor will
 * continue to have instructions for how to update their workspace.
 *
 * We deprecated this back in Nx 12, so it's time to force users to stop using it.
 *
 * TODO: Remove this file in Nx 16
 */
export function preprocessTypescript(
  config: any,
  customizeWebpackConfig?: (webpackConfig: any) => any
) {
  throw new Error(stripIndents`
    preprocessTypescript is now deprecated since Cypress has added typescript support.
    If you would still like preprocess files with webpack, use the "@cypress/webpack-preprocessor" package.`);
}
