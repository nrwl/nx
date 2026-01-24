# Expo SDK 54 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing Expo projects from Expo SDK 53 to Expo SDK 54. Work systematically through each breaking change category.

## Pre-Migration Checklist

1. **Identify all Expo projects**:

   ```bash
   nx show projects --with-target start
   ```

2. **Locate all Expo configuration files**:
   - Search for `app.json` or `app.config.{js,ts}`
   - Search for `metro.config.{js,ts}`
   - Check `project.json` files for Expo-related configuration

3. **Identify affected code**:
   - Files importing from `expo-av`
   - Files importing from `expo-file-system`
   - Files using `StatusBar` configuration
   - Android-specific layout code
   - Files importing from `@expo/vector-icons`

4. **Check for Detox E2E testing projects**:
   - Search for `detox` in package.json dependencies
   - Look for `detox.config.js` or `.detoxrc.js` files

## Important Warnings

### Detox E2E Testing Not Supported

**Expo SDK 54 does not currently support Detox for end-to-end testing.** If your workspace includes Detox projects, be aware of the following:

1. **Impact**: E2E tests using Detox will not work after migrating to Expo SDK 54
2. **Detection**: Check for `detox` in package.json dependencies or projects with `detox.config.js`

**Action Required**: If Detox projects are detected, you MUST ask the user before proceeding:

> "Your workspace contains Detox E2E tests. Detox is not currently supported in Expo SDK 54. Do you want to proceed with the migration knowing that Detox tests will not work until Detox adds SDK 54 support?"

**Alternatives to consider**:

- Stay on Expo SDK 53 if Detox E2E testing is critical for your workflow
- Wait for Detox to add Expo SDK 54 support
- Consider migrating to [Maestro](https://maestro.mobile.dev/) for E2E testing (has Expo SDK 54 support)

## Migration Steps by Category

### 1. expo-av to expo-audio and expo-video Migration

The `expo-av` package has been deprecated and split into two separate packages: `expo-audio` and `expo-video`.

#### 1.1 Audio Migration

**Search Pattern**: `import.*from ['"]expo-av['"]` with `Audio` usage

**Changes Required**:

```typescript
// BEFORE (Expo SDK 53)
import { Audio } from 'expo-av';

const sound = new Audio.Sound();
await sound.loadAsync(require('./audio.mp3'));
await sound.playAsync();

// AFTER (Expo SDK 54)
import { useAudioPlayer } from 'expo-audio';

function AudioComponent() {
  const player = useAudioPlayer(require('./audio.mp3'));

  const play = () => player.play();
  const pause = () => player.pause();

  return <Button onPress={play} title="Play" />;
}
```

**Action Items**:

- [ ] Install `expo-audio`: `npx expo install expo-audio`
- [ ] Remove `expo-av` if only used for audio
- [ ] Replace `Audio.Sound` with `useAudioPlayer` hook
- [ ] Replace `Audio.Recording` with `useAudioRecorder` hook
- [ ] Update audio playback control methods (`playAsync` -> `play`, etc.)
- [ ] Convert class-based audio handling to hook-based approach

#### 1.2 Video Migration

**Search Pattern**: `import.*from ['"]expo-av['"]` with `Video` usage

**Changes Required**:

```tsx
// BEFORE (Expo SDK 53)
import { Video } from 'expo-av';

function VideoPlayer() {
  return (
    <Video
      source={{ uri: 'https://example.com/video.mp4' }}
      style={{ width: 300, height: 200 }}
      useNativeControls
      resizeMode="contain"
    />
  );
}

// AFTER (Expo SDK 54)
import { VideoView, useVideoPlayer } from 'expo-video';

function VideoPlayer() {
  const player = useVideoPlayer('https://example.com/video.mp4', (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: 300, height: 200 }}
      nativeControls
      contentFit="contain"
    />
  );
}
```

**Action Items**:

- [ ] Install `expo-video`: `npx expo install expo-video`
- [ ] Remove `expo-av` if only used for video
- [ ] Replace `Video` component with `VideoView` and `useVideoPlayer`
- [ ] Replace `resizeMode` prop with `contentFit`
- [ ] Replace `useNativeControls` prop with `nativeControls`
- [ ] Update video control methods to use the player instance

### 2. expo-file-system Import Path Changes

**Search Pattern**: `import.*from ['"]expo-file-system/next['"]`

**Changes Required**:

```typescript
// BEFORE (Expo SDK 53)
import { File, Directory } from 'expo-file-system/next';

// AFTER (Expo SDK 54)
import { File, Directory } from 'expo-file-system';
```

**Action Items**:

- [ ] Replace all `expo-file-system/next` imports with `expo-file-system`
- [ ] Verify API compatibility (the API is now stable)

### 3. StatusBar Configuration Removal

In Expo SDK 54, the `expo-status-bar` configuration is now handled differently. The old `userInterfaceStyle` in `app.json` affects status bar theming.

**Search Pattern**: `userInterfaceStyle` in `app.json` or `app.config.*`

**Changes Required**:

```json
// BEFORE (Expo SDK 53)
{
  "expo": {
    "userInterfaceStyle": "automatic",
    "ios": {
      "userInterfaceStyle": "light"
    },
    "android": {
      "userInterfaceStyle": "dark"
    }
  }
}

// AFTER (Expo SDK 54)
// The userInterfaceStyle is now handled via expo-system-ui
// For programmatic control, use:
```

```typescript
// AFTER (Expo SDK 54) - Programmatic control
import * as SystemUI from 'expo-system-ui';

// Set root view background color
SystemUI.setBackgroundColorAsync('#ffffff');
```

**Action Items**:

- [ ] Install `expo-system-ui`: `npx expo install expo-system-ui`
- [ ] Review `userInterfaceStyle` settings in app.json
- [ ] Move UI style handling to `expo-system-ui` if programmatic control is needed

### 4. Android Edge-to-Edge UI

Expo SDK 54 enables edge-to-edge display by default on Android. This means content can extend behind system bars (status bar and navigation bar).

**Search Pattern**: Android-specific styles, safe area handling, padding/margin adjustments

**Changes Required**:

```tsx
// BEFORE (Expo SDK 53) - Implicit safe area
function App() {
  return (
    <View style={{ flex: 1 }}>
      <Text>Content</Text>
    </View>
  );
}

// AFTER (Expo SDK 54) - Explicit safe area handling
import { SafeAreaView } from 'react-native-safe-area-context';
// or
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text>Content</Text>
    </SafeAreaView>
  );
}

// Or with hooks for more control
function App() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Text>Content</Text>
    </View>
  );
}
```

**Action Items**:

- [ ] Audit all screen components for safe area handling
- [ ] Install `react-native-safe-area-context` if not present
- [ ] Wrap root components with `SafeAreaProvider`
- [ ] Add `SafeAreaView` or use `useSafeAreaInsets` where content touches screen edges
- [ ] Test on Android devices/emulators to verify UI doesn't overlap system bars
- [ ] Pay special attention to:
  - Header components
  - Bottom navigation/tab bars
  - Modal components
  - Full-screen media players

### 5. React Native Reanimated Version Decision

Expo SDK 54 supports both Reanimated v3 and v4. If you're using New Architecture, you should upgrade to v4.

**Search Pattern**: `react-native-reanimated` in package.json, worklet functions

**Reanimated v3 (stable)**:

```bash
npx expo install react-native-reanimated@3
```

**Reanimated v4 (recommended for New Architecture)**:

```bash
npx expo install react-native-reanimated@4
```

**Action Items**:

- [ ] Check if New Architecture is enabled in your project
- [ ] If using New Architecture, upgrade to Reanimated v4
- [ ] If staying on old architecture, Reanimated v3 is fine
- [ ] Test all animations after the upgrade

### 6. @expo/vector-icons Validation

Some icons in `@expo/vector-icons` may have been renamed or removed in SDK 54.

**Search Pattern**: `import.*from ['"]@expo/vector-icons['"]`

**Action Items**:

- [ ] Run the app and check console for warnings about missing icons
- [ ] Search for icon names that may have changed
- [ ] Update icon names as needed
- [ ] Consider using the Expo Vector Icons directory to find replacements: https://icons.expo.fyi/

### 7. React 19.1 Compatibility

Expo SDK 54 uses React 19.1 and React Native 0.81.

**Search Pattern**: `React.FC`, deprecated lifecycle methods, legacy context API

**Changes Required**:

```typescript
// BEFORE - React.FC (discouraged in React 19)
const MyComponent: React.FC<Props> = ({ title }) => {
  return <Text>{title}</Text>;
};

// AFTER - Direct function typing
function MyComponent({ title }: Props) {
  return <Text>{title}</Text>;
}

// Or with explicit return type
const MyComponent = ({ title }: Props): React.ReactElement => {
  return <Text>{title}</Text>;
};
```

**Action Items**:

- [ ] Update TypeScript types for React 19.1 (`@types/react@~19.1.0`)
- [ ] Remove usage of `React.FC` pattern (optional but recommended)
- [ ] Check for deprecated lifecycle methods and update to hooks
- [ ] Verify third-party libraries are compatible with React 19.1

### 8. Metro Configuration Updates

Expo SDK 54 uses Metro 0.83 with updated configuration.

**Search Pattern**: `metro.config.{js,ts}`

**Changes Required**:

```javascript
// BEFORE (Expo SDK 53)
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// AFTER (Expo SDK 54) - Same API, but verify compatibility
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure any custom transformers are compatible with Metro 0.83
```

**Action Items**:

- [ ] Update `@expo/metro-config` to `~0.22.0`
- [ ] Update `metro-config` to `~0.83.0`
- [ ] Update `metro-resolver` to `~0.83.0`
- [ ] Test custom Metro plugins/transformers for compatibility

### 9. Babel Configuration Cleanup

Expo SDK 54 updates to `babel-preset-expo@~14.0.0`.

**Search Pattern**: `babel.config.js`, `.babelrc`

**Action Items**:

- [ ] Update `babel-preset-expo` to `~14.0.0`
- [ ] Remove any deprecated Babel plugins
- [ ] Clear Metro cache after Babel changes: `npx expo start --clear`

## Post-Migration Validation

### 1. Clear All Caches

```bash
# Clear Expo cache
npx expo start --clear

# Clear Metro bundler cache
rm -rf node_modules/.cache/metro-*

# Clear Nx cache if needed
nx reset
```

### 2. Run Tests Per Project

```bash
# Test each project individually
nx run-many -t test -p PROJECT_NAME
```

### 3. Run All Tests

```bash
# Run tests across all affected projects
nx affected -t test
```

### 4. Test on Device/Simulator

```bash
# iOS
nx run PROJECT_NAME:run-ios

# Android
nx run PROJECT_NAME:run-android
```

### 5. Review Migration Checklist

- [ ] All `expo-av` usages migrated to `expo-audio` or `expo-video`
- [ ] All `expo-file-system/next` imports updated
- [ ] Safe area handling verified on Android
- [ ] All icon references validated
- [ ] React 19.1 compatibility verified
- [ ] Metro and Babel configurations updated
- [ ] All tests pass
- [ ] App runs on iOS simulator/device
- [ ] App runs on Android emulator/device

## Common Issues and Solutions

### Issue: Audio playback stops when component unmounts

**Solution**: The new `useAudioPlayer` hook manages cleanup automatically. If you need persistent audio, consider using a context or state management solution.

### Issue: Video player shows black screen

**Solution**: Ensure you're using `useVideoPlayer` with `VideoView`. Check that the video source URL is correct and accessible.

### Issue: Content hidden behind Android navigation bar

**Solution**: Wrap your screen content with `SafeAreaView` from `react-native-safe-area-context` or use `useSafeAreaInsets` for custom padding.

### Issue: Missing icons after upgrade

**Solution**: Check the Expo Vector Icons directory for renamed icons: https://icons.expo.fyi/

### Issue: TypeScript errors with React 19.1

**Solution**: Update `@types/react` to `~19.1.0` and check for deprecated patterns.

### Issue: Metro bundler fails to start

**Solution**: Clear all caches with `npx expo start --clear` and ensure Metro packages are at compatible versions.

## Files to Review

Create a checklist of all files that need review:

```bash
# Configuration files
find . -name "app.json" -o -name "app.config.*"
find . -name "metro.config.*"
find . -name "babel.config.*"

# Files with expo-av imports
rg "from ['\"]expo-av['\"]" --type ts --type tsx --type js

# Files with expo-file-system/next imports
rg "from ['\"]expo-file-system/next['\"]" --type ts --type tsx --type js

# Files with vector-icons imports
rg "from ['\"]@expo/vector-icons['\"]" --type ts --type tsx --type js

# Safe area related files
rg "SafeAreaView|useSafeAreaInsets" --type ts --type tsx --type js
```

## Migration Strategy for Large Workspaces

1. **Migrate in phases**: Start with a small project, validate, then expand
2. **Use feature branches**: Create separate branches for different migration aspects
3. **Run tests frequently**: After each configuration change, run affected tests
4. **Document issues**: Keep track of project-specific issues and solutions
5. **Test on real devices**: Android edge-to-edge changes require device testing

## Useful Commands During Migration

```bash
# Find all Expo projects
nx show projects --with-target start

# Run specific project
nx start PROJECT_NAME

# Test specific project after changes
nx test PROJECT_NAME

# Test all affected
nx affected -t test

# View project details
nx show project PROJECT_NAME --web

# Clear Nx cache if needed
nx reset

# Clear Expo cache
npx expo start --clear
```

---

## Notes for LLM Execution

When executing this migration:

1. **Work systematically**: Complete one category before moving to the next
2. **Test after each change**: Don't batch all changes without validation
3. **Keep user informed**: Report progress through each section
4. **Handle errors promptly**: If tests fail, fix immediately before proceeding
5. **Update documentation**: Note any workspace-specific patterns or issues
6. **Create meaningful commits**: Group related changes together with clear messages
7. **Use TodoWrite tool**: Track migration progress for visibility
8. **Test on both platforms**: Expo changes often affect iOS and Android differently
