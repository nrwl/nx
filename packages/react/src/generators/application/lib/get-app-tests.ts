import { NormalizedSchema } from '../schema';

export function getAppTests(options: NormalizedSchema) {
  return `it('should render successfully', () => {
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
        ? 'const { getAllByText } = render(<BrowserRouter><App /></BrowserRouter>);'
        : 'const { getAllByText } = render(<App />);'
    }
    expect(getAllByText(new RegExp('Welcome ${
      options.projectName
    }', 'gi')).length > 0).toBeTruthy();
  });
`;
}
