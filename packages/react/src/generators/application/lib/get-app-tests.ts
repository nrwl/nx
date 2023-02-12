import { NormalizedSchema } from '../schema';

export function getAppTests(options: NormalizedSchema) {
  return `
it('should render successfully', () => {
  ${
    options.routing
      ? 'const { baseElement } = render(<BrowserRouter><App /></BrowserRouter>);'
      : 'const { baseElement } = render(<App />);'
  }
  expect(baseElement).toBeTruthy();
});

it('should have a greeting as the title', () => {
  ${
    options.routing
      ? 'const { getByText } = render(<BrowserRouter><App /></BrowserRouter>);'
      : 'const { getByText } = render(<App />);'
  }
  expect(getByText(/Welcome ${options.projectName}/gi)).toBeTruthy();
});
`;
}
