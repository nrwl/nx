import { RouterProvider } from 'react-router-dom';
import { getRouter } from './get-router';
import { ThemeProvider } from '@nx/graph-internal-ui-theme';

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={getRouter()} />
    </ThemeProvider>
  );
}
