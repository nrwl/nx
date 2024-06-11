import { themeInit } from '@nx/graph/ui-theme';
import { rankDirInit } from './rankdir-resolver';
import { RouterProvider } from 'react-router-dom';
import { getRouter } from './get-router';

themeInit();
rankDirInit();

export function App() {
  return <RouterProvider router={getRouter()} />;
}
