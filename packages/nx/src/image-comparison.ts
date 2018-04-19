import { browser, ProtractorBrowser, promise, ElementFinder } from 'protractor';

export interface ProtractorImageComparison {
  /**
   * Runs the comparison against an element.
   * @return The percentage of the difference.
   */
  checkElement(
    element: ElementFinder,
    tag: string,
    options?: any
  ): promise.Promise<number>;

  /**
   * Runs the comparison against the fullpage screenshot.
   * @return The percentage of the difference.
   */
  checkFullPageScreen(tag: string, options?: any): promise.Promise<number>;

  /**
   * Runs the comparison against the screen.
   * @return The percentage of the difference.
   */
  checkScreen(tag: string, options?: any): promise.Promise<number>;

  /**
   * Saves an image of the screen element.
   * @return The image has been saved when the promise is resolved.
   */
  saveElement(
    element: ElementFinder,
    tag: string,
    options
  ): promise.Promise<void>;

  /**
   * Saves a full page image of the screen.
   * @return The image has been saved when the promise is resolved.
   */
  saveFullPageScreen(tag: string, options?: any): promise.Promise<void>;

  /**
   * Saves an image of the screen.
   * @return The image has been saved when the promise is resolved.
   */
  saveScreen(tag: string, options?: any): promise.Promise<void>;
}

export class NxProtractorBrowser extends ProtractorBrowser {
  protractorImageComparison: ProtractorImageComparison;
}

export const imageComparison = (browser as NxProtractorBrowser)
  .protractorImageComparison;
