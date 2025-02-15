import { createRemixStub } from '@remix-run/testing';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import Index from '../../app/routes/_index';

test('renders loader data', async () => {
  const RemixStub = createRemixStub([
    {
      path: '/',
      Component: Index,
    },
  ]);

  render(<RemixStub />);

  await screen.findByText('Hello there,');
});
