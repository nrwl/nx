/**
 * Toggle inspired from https://github.com/infinitered/ignite/blob/master/boilerplate/storybook/toggle-storybook.tsx
 */
import React, { useState, useEffect, useRef } from 'react';
import { DevSettings } from 'react-native';

import AppRoot from '../app/App';

export const DEFAULT_REACTOTRON_WS_URI = 'ws://localhost:9090';

/**
 * Toggle Storybook mode, in __DEV__ mode only.
 *
 * In non-__DEV__ mode, or when Storybook isn't toggled on,
 * renders its children.
 *
 * The mode flag is persisted in async storage, which means it
 * persists across reloads/restarts - this is handy when developing
 * new components in Storybook.
 */
function ToggleStorybook(props) {
  const [showStorybook, setShowStorybook] = useState(false);
  const [StorybookUIRoot, setStorybookUIRoot] = useState(null);
  const ws = useRef(new WebSocket(DEFAULT_REACTOTRON_WS_URI));

  useEffect(() => {
    if (!__DEV__) {
      return undefined;
    }

    if (DevSettings) {
      // Add our toggle command to the menu
      DevSettings.addMenuItem('Toggle Storybook', () => {
        setShowStorybook((show) => {
          // On toggle, flip the current value
          show = !show;

          // Return it to change the local state
          return show;
        });
      });
    }

    // Load the storybook UI once
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    setStorybookUIRoot(() => require('./storybook.ts').default);

    // Behave as Reactotron.storybookSwitcher(), not a HOC way.
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === 'storybook') {
        setShowStorybook(data.payload);
      }
    };
    ws.current.onerror = (e) => {
      setShowStorybook(false);
    };
  });

  if (showStorybook) {
    return StorybookUIRoot ? <StorybookUIRoot /> : null;
  } else {
    return props.children;
  }
}

export default () => {
  return (
    <ToggleStorybook>
      <AppRoot />
    </ToggleStorybook>
  );
};
