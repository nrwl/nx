<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react.png" width="600" alt="Nx - Smart, Extensible Build Framework"></p>

{{links}}

<hr>

# Expo Plugin for Nx

{{what-is-nx}}

{{getting-started}}

```
? Workspace name (e.g., org name)     happyorg
? What to create in the new workspace expo    [a workspace with a single expo application]
? Application name                    myapp
```

If it's your first Nx project, the command will recommend you to install the `nx` package globally, so you can invoke `nx` directly without going through yarn or npm.

### Serving Application

- Run `nx start myapp` to start a local dev server for the app.
- Run `nx run myapp --platform=ios` to run the iOS app binary locally.
- Run `nx run myapp --platform=android` to run the Android app binary locally.
- Run `nx test myapp` to test it.
- Run `nx test-ios myapp-e2e` to run e2e tests for it on iOS.
- Run `nx test-android myapp-e2e` to run e2e tests for it on Android.
- Run `nx ensure-symlink myapp` to ensure workspace node_modules is symlink under app's node_modules folder.
- Run `nx sync-deps myapp` to update package.json with project dependencies. For example: `nx sync-deps myapp --include=react-native-gesture-handler,react-native-safe-area-context`
- Run `nx build-ios myapp` to build and sign a standalone IPA for the Apple App Store.
- Run `nx build-android myapp` to build and sign a standalone APK or App Bundle for the Google Play Store.
- Run `nx build-status myapp` to get the status of the latest build for the project.

### Adding Expo Plugin Into an Existing Workspace

You can always add the Expo plugin to an existing workspace by installing `@nrwl/expo` and then generating an Expo application, as follows: `nx g @nrwl/expo:app myapp`.

## Quick Start Videos

<a href="https://www.youtube.com/watch?v=E188J7E_MDU" target="_blank">
<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react-video.png" width="350" alt="Nx - Quick start video"></p>
</a>

{{resources}}
