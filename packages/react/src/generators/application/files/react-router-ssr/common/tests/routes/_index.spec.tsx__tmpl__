import { createRoutesStub } from 'react-router';
import { render, screen } from '@testing-library/react';
import App from '../../app/app';

test('renders loader data', async () => {
  const ReactRouterStub = createRoutesStub([
    {
      path: '/',
      Component: App,
    },
  ]);

  render(<ReactRouterStub />);

  expect(await screen.findByText('Hello there,')).toBeTruthy();
});
