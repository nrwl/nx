import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-splash-screen-config';

describe('update-splash-screen-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should transform legacy splash screen configuration to plugin format in app.json', async () => {
    // Add an Expo project with legacy splash screen config
    tree.write(
      'apps/my-app/project.json',
      JSON.stringify({
        name: 'my-app',
        projectType: 'application',
        root: 'apps/my-app',
        targets: {},
      })
    );

    tree.write(
      'apps/my-app/package.json',
      JSON.stringify({
        name: 'my-app',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    tree.write(
      'apps/my-app/app.json',
      JSON.stringify({
        expo: {
          name: 'MyApp',
          slug: 'my-app',
          splash: {
            imageUrl: './assets/splash.png',
            backgroundColor: '#ffffff',
            resizeMode: 'contain',
            tabletImage: './assets/splash-tablet.png',
          },
        },
      })
    );

    await update(tree);

    const appConfig = readJson(tree, 'apps/my-app/app.json');

    // Should have plugins array with expo-splash-screen
    expect(appConfig.expo.plugins).toBeDefined();
    expect(appConfig.expo.plugins).toHaveLength(1);
    expect(appConfig.expo.plugins[0]).toEqual([
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 200,
        backgroundColor: '#ffffff',
        resizeMode: 'contain',
        tabletImage: './assets/splash-tablet.png',
      },
    ]);

    // Legacy splash config should be removed
    expect(appConfig.expo.splash).toBeUndefined();
  });

  it('should not modify projects that are not Expo projects', async () => {
    // Add a non-Expo project
    tree.write(
      'apps/react-app/project.json',
      JSON.stringify({
        name: 'react-app',
        projectType: 'application',
        root: 'apps/react-app',
        targets: {},
      })
    );

    tree.write(
      'apps/react-app/package.json',
      JSON.stringify({
        name: 'react-app',
        dependencies: {
          react: '^18.0.0',
        },
      })
    );

    await update(tree);

    // Should not create any config files
    expect(tree.exists('apps/react-app/app.json')).toBeFalsy();
  });

  it('should transform splash configuration to plugin format in JS config files', async () => {
    tree.write(
      'apps/my-expo-app/project.json',
      JSON.stringify({
        name: 'my-expo-app',
        projectType: 'application',
        root: 'apps/my-expo-app',
        targets: {},
      })
    );

    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    const configContent = `
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'MyExpoApp',
  slug: 'my-expo-app',
  splash: {
    imageUrl: './assets/splash.png',
    backgroundColor: '#ffffff'
  }
};

export default config;
`;

    tree.write('apps/my-expo-app/app.config.ts', configContent);

    await update(tree);

    const updatedContent = tree.read('apps/my-expo-app/app.config.ts', 'utf-8');
    expect(updatedContent).toContain(
      'migrated to use expo-splash-screen plugin'
    );
    expect(updatedContent).toContain('plugins: [');
    expect(updatedContent).toContain('expo-splash-screen');
    expect(updatedContent).toContain("image: './assets/splash.png'");
    expect(updatedContent).toContain("backgroundColor: '#ffffff'");
    expect(updatedContent).toContain('imageWidth: 200');
    expect(updatedContent).not.toContain('splash: {');
  });

  it('should skip projects without splash screen configuration', async () => {
    tree.write(
      'apps/simple-expo/project.json',
      JSON.stringify({
        name: 'simple-expo',
        projectType: 'application',
        root: 'apps/simple-expo',
        targets: {},
      })
    );

    tree.write(
      'apps/simple-expo/package.json',
      JSON.stringify({
        name: 'simple-expo',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    tree.write(
      'apps/simple-expo/app.json',
      JSON.stringify({
        expo: {
          name: 'SimpleExpo',
          slug: 'simple-expo',
        },
      })
    );

    await update(tree);

    const appConfig = readJson(tree, 'apps/simple-expo/app.json');
    expect(appConfig.expo.splash).toBeUndefined();
    expect(appConfig.expo.plugins).toBeUndefined();
  });

  it('should handle existing plugins array and update expo-splash-screen plugin', async () => {
    tree.write(
      'apps/existing-plugins/project.json',
      JSON.stringify({
        name: 'existing-plugins',
        projectType: 'application',
        root: 'apps/existing-plugins',
        targets: {},
      })
    );

    tree.write(
      'apps/existing-plugins/package.json',
      JSON.stringify({
        name: 'existing-plugins',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    tree.write(
      'apps/existing-plugins/app.json',
      JSON.stringify({
        expo: {
          name: 'ExistingPlugins',
          slug: 'existing-plugins',
          plugins: [
            'expo-font',
            ['expo-splash-screen', { image: './old-image.png' }],
          ],
          splash: {
            image: './assets/new-splash.png',
            backgroundColor: '#000000',
            resizeMode: 'cover',
          },
        },
      })
    );

    await update(tree);

    const appConfig = readJson(tree, 'apps/existing-plugins/app.json');

    // Should update the existing plugin configuration
    expect(appConfig.expo.plugins).toHaveLength(2);
    expect(appConfig.expo.plugins[0]).toBe('expo-font');
    expect(appConfig.expo.plugins[1]).toEqual([
      'expo-splash-screen',
      {
        image: './assets/new-splash.png',
        imageWidth: 200,
        backgroundColor: '#000000',
        resizeMode: 'cover',
      },
    ]);

    // Legacy splash config should be removed
    expect(appConfig.expo.splash).toBeUndefined();
  });

  it('should add expo-splash-screen plugin to existing plugins array', async () => {
    tree.write(
      'apps/add-plugin/project.json',
      JSON.stringify({
        name: 'add-plugin',
        projectType: 'application',
        root: 'apps/add-plugin',
        targets: {},
      })
    );

    tree.write(
      'apps/add-plugin/package.json',
      JSON.stringify({
        name: 'add-plugin',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    tree.write(
      'apps/add-plugin/app.json',
      JSON.stringify({
        expo: {
          name: 'AddPlugin',
          slug: 'add-plugin',
          plugins: ['expo-font', 'expo-notifications'],
          splash: {
            image: './assets/splash.png',
            backgroundColor: '#ff0000',
          },
        },
      })
    );

    await update(tree);

    const appConfig = readJson(tree, 'apps/add-plugin/app.json');

    // Should add the splash screen plugin to existing plugins
    expect(appConfig.expo.plugins).toHaveLength(3);
    expect(appConfig.expo.plugins[0]).toBe('expo-font');
    expect(appConfig.expo.plugins[1]).toBe('expo-notifications');
    expect(appConfig.expo.plugins[2]).toEqual([
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 200,
        backgroundColor: '#ff0000',
      },
    ]);

    // Legacy splash config should be removed
    expect(appConfig.expo.splash).toBeUndefined();
  });

  it('should transform splash configuration with image property to plugin format', async () => {
    tree.write(
      'apps/updated-expo/project.json',
      JSON.stringify({
        name: 'updated-expo',
        projectType: 'application',
        root: 'apps/updated-expo',
        targets: {},
      })
    );

    tree.write(
      'apps/updated-expo/package.json',
      JSON.stringify({
        name: 'updated-expo',
        dependencies: {
          expo: '^53.0.0',
        },
      })
    );

    tree.write(
      'apps/updated-expo/app.json',
      JSON.stringify({
        expo: {
          name: 'UpdatedExpo',
          slug: 'updated-expo',
          splash: {
            image: './assets/splash.png',
            backgroundColor: '#ffffff',
            resizeMode: 'contain',
          },
        },
      })
    );

    await update(tree);

    const appConfig = readJson(tree, 'apps/updated-expo/app.json');

    // Should have plugins array with expo-splash-screen
    expect(appConfig.expo.plugins).toBeDefined();
    expect(appConfig.expo.plugins).toHaveLength(1);
    expect(appConfig.expo.plugins[0]).toEqual([
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 200,
        backgroundColor: '#ffffff',
        resizeMode: 'contain',
      },
    ]);

    // Legacy splash config should be removed
    expect(appConfig.expo.splash).toBeUndefined();
  });
});
