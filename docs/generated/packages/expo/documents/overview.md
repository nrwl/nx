Expo is an open-source framework for apps that run natively on Android, iOS, and the web. Expo brings together the best of mobile and the web and enables many important features for building and scaling an app.

Expo is a set of tools built on top of React Native. The Nx Plugin for Expo contains generators for managing Expo applications and libraries within an Nx workspace.

## Setting Up Expo

To create a new workspace with expo, run the following command:

```shell
 npx create-nx-workspace --preset=expo
```

### Adding Expo to an Existing Project

Install the expo plugin

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/expo
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/expo
```

{% /tab %}
{% /tabs %}

### Creating Applications

Add a new application to your workspace with the following command:

```shell
nx g @nx/expo:app my-app
```

Start the application by running:

```shell
nx start my-app
```

### Generating Libraries

To generate a new library run:

```shell
npx nx g @nx/react-native:lib your-lib-name
```

### Generating Components

To generate a new component inside library run:

```shell
npx nx g @nx/react-native:component your-component-name --project=your-lib-name --export
```

Replace `your-lib-name` with the app's name as defined in your `tsconfig.base.json` file or the `name` property of your `package.json`

## Using Expo

### Start a Development Server

You can start a development server by running:

```shell
nx start <app-name>
```

### Compile App Locally

You can compile your app locally with `run-ios` and `run-android` commands:

{% tabs %}
{%tab label="iOS"%}

Compile for iOS:

```shell
nx run-ios <app-name>
```

{% /tab %}
{%tab label="Android"%}

Compile for Android:

```shell
nx run-android <app-name>
```

{% /tab %}
{% /tabs %}

To run these commands, you need to have your development environment setup. To run an iOS app,it can only be run on a Mac, and Xcode must be installed. Similarly, to run an Android app, it requires Android Studio and Java to be installed and configured on your computer. Setup steps: https://reactnative.dev/docs/environment-setup.

### Compile Web Assets

You can build your JavaScript bundle using Metro bundler by running:

```shell
nx export <app-name>
```

{% tabs %}
{%tab label="All Platforms"%}

Compile for all platforms:

```shell
nx export <app-name> --platform=all
```

{% /tab %}
{%tab label="iOS"%}

Compile for iOS:

```shell
nx export <app-name> --platform=ios
```

{% /tab %}
{%tab label="Android"%}

Compile for Android:

```shell
nx export <app-name> --platform=android
```

{% /tab %}
{%tab label="Web"%}

Compile for Web:

```shell
nx export <app-name> --platform=web
```

{% /tab %}
{% /tabs %}

### Generate Native Code

To generate native code, run:

```shell
nx prebuild <app-name>
```

{% tabs %}
{%tab label="All Platforms"%}

Generate for all platforms:

```shell
nx prebuild <app-name> --platform=all
```

{% /tab %}
{%tab label="iOS"%}

Generate for iOS:

```shell
nx prebuild <app-name> --platform=ios
```

{% /tab %}
{%tab label="Android"%}

Generate for Android:

```shell
nx prebuild <app-name> --platform=android
```

{% /tab %}
{% /tabs %}

### Install Compatible NPM Packages

To install packages that is compatible with current version of Expo, run:

```shell
nx install <app-name>
```

Unlike npm's `install` command, this `install` command will install the exact right version for currently installed copy of Expo.

To install a specify NPM package, run:

```shell
nx install <app-name> --packages=<packpage-name>
nx install <app-name> --packages=<packpage-name-1>,<packpage-name-2>,<packpage-name-3>
```

To check and fix package versions, run:

{% tabs %}
{%tab label="check"%}

Check which packages needed to be updated:

```shell
nx install <app-name> --check
```

{% /tab %}
{%tab label="fix"%}

Automatically update invalid packages versions:

```shell
nx install <app-name> --fix
```

{% /tab %}
{% /tabs %}

### Run an EAS Build

Expo Application Services (EAS) are deeply integrated cloud services for Expo and React Native apps. EAS Build is a hosted service for building app binaries for your Expo and React Native projects.

To run an EAS build:

```shell
nx build <app-name>
```

If you are not signed into an EAS account, run the following command to log in:

```shell
npx eas login
```

To check the details of your build status, run:

```shell
nx build-list  <app-name>
```

### Testing Projects

You can run unit tests with:

```shell
nx test <project-name>
```

## Expo Commands

Below table is a map between expo commands and Nx commands:

| Expo Commands      | Nx Commands                 |
| ------------------ | --------------------------- |
| `expo start`       | `nx start <app-name>`       |
| `expo run:ios`     | `nx run-ios <app-name>`     |
| `expo run:android` | `nx run-android <app-name>` |
| `expo export`      | `nx export <app-name>`      |
| `expo prebuild`    | `nx prebuild <app-name>`    |
| `expo install`     | `nx install <app-name>`     |
| `eas build`        | `nx build <app-name>`       |
| `eas build:list`   | `nx build-list <app-name>`  |

## More Documentation

- [Using Detox](/packages/detox)
- [Using Jest](/packages/jest)
