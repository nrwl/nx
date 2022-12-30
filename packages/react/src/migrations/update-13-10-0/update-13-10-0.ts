import {
  addDependenciesToPackageJson,
  logger,
  readJson,
  Tree,
} from '@nrwl/devkit';

// Putting this here because React Native 0.67 is incompatible with React 18.
// Waiting for 0.68 to come out with support for React 18.
// TODO(jack): For Nx 14 let's add another migration for React 18 in migrations.json because by then React Native 0.68.0 should be released.
export async function updateToReact18(host: Tree) {
  const { dependencies } = readJson(host, 'package.json');
  if (
    dependencies['react-native'] &&
    !dependencies['react-native'].match(/[\^~]?0.68/)
  ) {
    logger.info(
      `React Native ${dependencies['react-native']} is incompatible with React 18. Skipping update until React Native 0.68.0 is released.`
    );
  } else {
    return addDependenciesToPackageJson(
      host,
      {
        react: '18.0.0',
        'react-dom': '18.0.0',
        'react-is': '18.0.0',
      },
      {
        'react-test-renderer': '18.0.0',
      }
    );
  }
}

export default updateToReact18;
