import { renderJson } from './json';
import { diagnostics } from './fixtures.spec-util';

describe('renderJson', () => {
  it("should render the task's diagnostics subset", () => {
    expect(JSON.parse(renderJson(diagnostics))).toEqual({ diagnostics });
  });
});
