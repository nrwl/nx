/**
 * Assert a text is present on the visited page.
 * @param path
 * @param title
 * @param selector
 */
export function assertTextOnPage(
  path: string,
  title: string,
  selector: string = 'h1'
): void {
  describe(path, () =>
    it(`should display "${title}"`, () => {
      cy.visit(path);
      cy.get(selector).should('contain.text', title);
    })
  );
}
