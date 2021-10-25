/**
 * Add this file because @storybook/react-native is in different repo from rest of the @storybook/uiFramewrok.
 * It does not have a file to used as frameworkOptions for packages/storybook/src/executors/storybook/storybook.impl.ts.
 * Create this file to generate frameworkOptions like https://github.com/storybookjs/storybook/blob/next/app/react/src/server/options.ts.
 */
import extendOptions from '@storybook/react-native-server/dist/server/options';

export default extendOptions({});
