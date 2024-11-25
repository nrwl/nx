import { config as loadDotEnvFile } from 'dotenv';
import { join } from 'path';

export const nxVersion = require('../../package.json').version;

const gradleNativeProperties = loadDotEnvFile({
  path: join(__dirname, `../../native/gradle.properties`),
});

export const gradlePluginVersion = gradleNativeProperties.parsed?.version;
