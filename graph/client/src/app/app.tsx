import { themeInit } from '@nx/graph/ui-theme';
import { rootStore } from '@nx/graph/state';
import { Provider as StoreProvider } from 'react-redux';
import { rankDirInit } from './rankdir-resolver';
import { RouterProvider } from 'react-router-dom';
import { getRouter } from './get-router';

themeInit();
rankDirInit();

export function App() {
  return (
    <StoreProvider store={rootStore}>
      <RouterProvider router={getRouter()} />
    </StoreProvider>
  );
}
