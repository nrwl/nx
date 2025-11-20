import { RouterProvider } from 'react-router-dom';
import { getRouter } from './get-router';
import {
  ThemeProvider,
  RankDirProvider,
} from '@nx/graph-internal-ui-render-config';

export function App() {
  return (
    <ThemeProvider>
      <RankDirProvider>
        <RouterProvider router={getRouter()} />
      </RankDirProvider>
    </ThemeProvider>
  );
}
