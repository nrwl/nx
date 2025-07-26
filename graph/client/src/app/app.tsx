import { RouterProvider } from 'react-router-dom';
import { getRouter } from './get-router';

export function App() {
  return <RouterProvider router={getRouter()} />;
}
