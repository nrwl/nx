export interface AnimationProps {
  /**
   * Controls whether the animation should play
   * @default true
   */
  autoPlay?: boolean;
  /**
   * Optional custom class name for the SVG
   */
  className?: string;
  /**
   * Amount of the element that needs to be visible before triggering
   * the in-view animation (0 to 1)
   * @default 0.3 (30% of the element needs to be visible)
   */
  inViewThreshold?: number;
  /**
   * Specifies whether the operation or event should occur only once.
   * If set to `true`, the action is executed a single time and subsequently disabled or ignored.
   * @default false
   */
  once?: boolean;
  /**
   * Controls the speed of the animation
   * @default 1
   */
  speed?: number;
}
