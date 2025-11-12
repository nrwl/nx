import { NormalizedSchema } from '../schema.js';

export function getComponentTests(schema: NormalizedSchema) {
  return `
  it('should render successfully', () => {
    const { baseElement } = render(<${schema.className} />);
    expect(baseElement).toBeTruthy();
  });
  `;
}
