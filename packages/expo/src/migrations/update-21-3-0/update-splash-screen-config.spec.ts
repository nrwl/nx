import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-splash-screen-config';

describe('update-splash-screen-config migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update legacy splash screen configuration in app.json', async () => {
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
    expect(appConfig.expo.splash.image).toBe('./assets/splash.png');
    expect(appConfig.expo.splash.backgroundColor).toBe('#ffffff');
    expect(appConfig.expo.splash.resizeMode).toBe('contain');
    expect(appConfig.expo.splash.tabletImage).toBe(
      './assets/splash-tablet.png'
    );
    expect(appConfig.expo.splash.imageUrl).toBeUndefined();
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

  it('should add migration comment to JS config files', async () => {
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
      'splash screen configuration has been updated'
    );
    expect(updatedContent).toContain("imageUrl' should be changed to 'image'");
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
  });

  it('should handle projects with already updated splash configuration', async () => {
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
    expect(appConfig.expo.splash.image).toBe('./assets/splash.png');
    expect(appConfig.expo.splash.backgroundColor).toBe('#ffffff');
    expect(appConfig.expo.splash.resizeMode).toBe('contain');
  });
});
