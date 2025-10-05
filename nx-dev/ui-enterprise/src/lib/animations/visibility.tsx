import {
  motion,
  useAnimation,
  useInView,
  useReducedMotion,
  Variants,
} from 'framer-motion';
import {
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { AnimationProps } from './animation.model';

/**
 * Visibility animation.
 *
 * @param {Object} props - Animation properties for configuring the visibility animation.
 * @param {boolean} [props.autoPlay=true] - Determines whether the animation starts automatically when in view.
 * @param {string} [props.className=''] - Additional class names for styling the component.
 * @param {number} [props.inViewThreshold=0.3] - Percentage of the component's visibility in the viewport required to trigger the animation (range: 0 to 1).
 * @param {boolean} [props.once=false] - If true, the animation will play only the first time the component enters the viewport.
 * @param {number} [props.speed=1] - Speed multiplier for the animation, where values greater than 1 speed it up and less than 1 slow it down.
 *
 * @return {ReactElement} A React SVG element with motion animations applied to visualize visibility effects.
 */
export function VisibilityAnimation({
  autoPlay = true,
  className = '',
  inViewThreshold = 0.3,
  once = false,
  speed = 1,
}: AnimationProps): ReactElement {
  // Generate unique IDs for SVG elements to prevent conflicts when multiple instances exist
  const uniqueId = useId().replace(/:/g, '');
  const networkId = `network-${uniqueId}`;
  const containerId = `container-${uniqueId}`;
  const bgBlurClipPathId = `bgblur-clip-path-${uniqueId}`;
  const filterBlurId = `filter-blur-${uniqueId}`;
  const radialGradientId = `radial-gradient-${uniqueId}`;

  const controls = useAnimation();
  const prefersReducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, {
    amount: inViewThreshold,
    once,
  });

  // Adjust animation timing based on speed
  const adjustTiming = useCallback((time: number) => time / speed, [speed]);

  const networkVariants: Variants = {
    hidden: {
      pathLength: 0,
      opacity: 0,
    },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: {
          delay: adjustTiming(1.8),
          duration: adjustTiming(1.5),
          ease: 'easeInOut',
        },
        opacity: {
          delay: adjustTiming(1.8),
          duration: adjustTiming(0.6),
        },
      },
    },
  };
  const indicatorVariants: Variants = {
    hidden: { opacity: 0.2 },
    visible: {
      opacity: 1,
      transition: {
        repeat: Infinity,
        repeatType: 'reverse',
        duration: adjustTiming(1.6),
        ease: 'easeInOut',
      },
    },
  };
  const iconGroupVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: adjustTiming(0.5),
        delayChildren: adjustTiming(0.4),
      },
    },
  };
  const iconVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: adjustTiming(0.5) },
    },
  };

  // Effect to control animation playback
  useEffect((): (() => void) | void => {
    if (prefersReducedMotion) {
      controls.set('visible');
      setHasAnimated(true);
      return;
    }

    const shouldPlay = autoPlay && inView && !hasAnimated;
    if (!shouldPlay) return;
    controls.start('visible').then(() => setHasAnimated(true));

    return () => controls.set('hidden');
  }, [autoPlay, inView, controls, hasAnimated, prefersReducedMotion]);

  return (
    <motion.svg
      ref={ref}
      width="553"
      height="427"
      viewBox="0 0 553 427"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial="hidden"
      animate={controls}
      className={className}
      aria-label="Animated visibility visualization"
      role="img"
      style={{ aspectRatio: `${553 / 427}` }}
    >
      <defs>
        <clipPath
          id={bgBlurClipPathId}
          transform="translate(-77.1922 -18.9276)"
        >
          <path d="M152.538 94.2734C152.538 98.669 155.624 102.648 160.613 105.529V255.601C155.624 252.721 152.538 248.741 152.538 244.346V94.2734Z" />
          <path d="M251.59 158.054C262.356 164.27 279.813 164.27 290.58 158.054V308.126C279.813 314.343 262.356 314.343 251.59 308.126V158.054Z" />
          <path d="M389.631 94.2734C389.631 98.669 386.545 102.648 381.556 105.529V255.601C386.545 252.721 389.631 248.741 389.631 244.346V94.2734Z" />
          <path d="M160.613 105.529V255.601L251.59 308.126V158.054L160.613 105.529Z" />
          <path d="M290.58 158.054V308.126L381.556 255.601V105.529L290.58 158.054Z" />
        </clipPath>
        <filter
          id={filterBlurId}
          x="160.525"
          y="81.3107"
          width="31.3728"
          height="25.7654"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="4.5263"
            result="effect1_foregroundBlur_333_20553"
          />
        </filter>
        <radialGradient
          id={radialGradientId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(270.913 242.674) rotate(90) scale(242.93 242.93)"
        >
          <stop offset="0.35" stopColor="rgba(241, 245, 249, 1)" />
          <stop offset="1" stopColor="rgba(241, 245, 249, 1)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <motion.path
        id={networkId}
        d="M495.427 114.09L48.1985 372.298M59.5143 119.584L484.112 364.725"
        stroke={`url(#${radialGradientId})`}
        strokeWidth="2.37569"
        variants={networkVariants}
        style={{ willChange: 'opacity, stroke-dashoffset' }}
        aria-hidden="true"
      />

      <g id={containerId}>
        <g id={`inner-container-${uniqueId}`}>
          <g id={`wrapper-${uniqueId}`}>
            <g id={`extrude-group-${uniqueId}`}>
              <path
                id={`base-face-${uniqueId}`}
                d="M251.589 30.4937C262.356 24.2775 279.812 24.2775 290.579 30.4937L381.555 83.019C392.322 89.2352 392.322 99.3136 381.555 105.53L290.579 158.055C279.812 164.271 262.356 164.271 251.589 158.055L160.613 105.53C149.846 99.3136 149.846 89.2351 160.613 83.019L251.589 30.4937Z"
                fill="#0F172A"
                stroke="rgba(241, 245, 249, 1)"
                strokeWidth="1.9"
                aria-hidden="true"
              />
              <foreignObject
                x="77.1922"
                y="18.9276"
                width="387.785"
                height="369.207"
                aria-hidden="true"
              >
                <div
                  style={{
                    backdropFilter: 'blur(37.67px)',
                    WebkitBackdropFilter: 'blur(37.67px)',
                    clipPath: `url(#${bgBlurClipPathId})`,
                    height: '100%',
                    width: '100%',
                  }}
                />
              </foreignObject>
              <g
                id={`vector-${uniqueId}`}
                data-figma-bg-blur-radius="75.3459"
                aria-hidden="true"
              >
                <path
                  d="M152.538 94.2734C152.538 98.669 155.624 102.648 160.613 105.529V255.601C155.624 252.721 152.538 248.741 152.538 244.346V94.2734Z"
                  fill="#0F172A"
                  fillOpacity="0.7"
                />
                <path
                  d="M251.59 158.054C262.356 164.27 279.813 164.27 290.58 158.054V308.126C279.813 314.343 262.356 314.343 251.59 308.126V158.054Z"
                  fill="#0F172A"
                  fillOpacity="0.7"
                />
                <path
                  d="M389.631 94.2734C389.631 98.669 386.545 102.648 381.556 105.529V255.601C386.545 252.721 389.631 248.741 389.631 244.346V94.2734Z"
                  fill="#0F172A"
                  fillOpacity="0.7"
                />
                <path
                  d="M160.613 105.529V255.601L251.59 308.126V158.054L160.613 105.529Z"
                  fill="#0F172A"
                  fillOpacity="0.7"
                />
                <path
                  d="M290.58 158.054V308.126L381.556 255.601V105.529L290.58 158.054Z"
                  fill="#0F172A"
                  fillOpacity="0.7"
                />
              </g>
              <path
                id={`vector-2-${uniqueId}`}
                d="M152.538 94.2734V244.346M389.631 94.2734V244.346"
                stroke="rgba(241, 245, 249, 1)"
                strokeWidth="1.9"
                aria-hidden="true"
              />
              <path
                id={`vector-3-${uniqueId}`}
                d="M152.538 244.348C152.538 248.743 155.624 252.723 160.613 255.603L251.59 308.128C262.356 314.345 279.813 314.345 290.58 308.128L381.556 255.603C386.545 252.723 389.631 248.743 389.631 244.348"
                stroke="rgba(241, 245, 249, 1)"
                strokeWidth="1.9"
                aria-hidden="true"
              />
              <path
                id={`vector-4-${uniqueId}`}
                d="M160.613 105.531V255.603M290.58 308.129V158.057C279.813 164.273 262.356 164.273 251.59 158.057V308.129M381.556 105.531V255.603"
                stroke="rgba(241, 245, 249, 1)"
                strokeOpacity="0.2"
                strokeWidth="1.9"
                aria-hidden="true"
              />
              <path
                id={`vector-5-${uniqueId}`}
                d="M152.538 94.2734C152.538 98.669 155.624 102.648 160.613 105.529L251.59 158.054C262.356 164.27 279.813 164.27 290.58 158.054L381.556 105.529C386.545 102.648 389.631 98.669 389.631 94.2734"
                stroke="rgba(241, 245, 249, 1)"
                strokeWidth="1.9"
                aria-hidden="true"
              />
              <g id={`group-${uniqueId}`} aria-hidden="true">
                <path
                  id={`vector-6-${uniqueId}`}
                  d="M242.988 73.8649C239.494 75.8822 236.722 78.2771 234.831 80.9129C232.94 83.5486 231.967 86.3736 231.967 89.2266C231.967 94.9883 235.931 100.514 242.988 104.588C254.748 111.378 272.362 112.73 286.464 108.674C288.008 108.029 287.608 107.307 286.89 106.893L282.393 104.296C276.62 109.473 269.888 107.399 269.888 107.399C265.578 106.324 263.023 106.846 263.023 106.846C258.952 107.292 261.613 105.817 261.613 105.817C264.46 104.389 268.425 105.049 268.425 105.049C274.784 106.048 277.498 103.098 278.376 101.854C276.886 100.717 276.407 99.6418 276.487 98.8276C269.915 101.854 261.427 104.112 251.29 98.2592C248.336 96.5541 246.979 94.6032 246.82 92.514C245.888 92.2835 242.19 91.2236 240.061 88.3049C240.061 88.3049 241.578 86.5997 250.092 85.6473C251.609 84.0958 253.604 82.6057 255.866 81.2999C258.128 79.9942 260.708 78.8421 263.396 77.9664C265.045 73.0507 267.999 72.1751 267.999 72.1751C273.054 73.404 274.89 75.5393 275.289 76.077C278.908 76.1691 282.287 76.9526 285.24 78.6577C295.404 84.5259 291.413 89.4109 286.145 93.2206C287.928 93.1438 290.429 93.5739 292.903 95.0026L300.194 99.2117C300.912 99.6264 302.189 99.8722 303.307 98.9505C310.304 90.7935 307.963 80.6547 296.203 73.8649C292.708 71.8476 288.56 70.2473 283.995 69.1556C279.43 68.0638 274.537 67.5019 269.595 67.5019C264.654 67.5019 259.761 68.0638 255.196 69.1556C250.63 70.2473 246.482 71.8476 242.988 73.8649Z"
                  fill="rgba(241, 245, 249, 1)"
                />
              </g>
            </g>
          </g>
        </g>
      </g>

      <motion.g
        id={`icon-group-${uniqueId}`}
        variants={iconGroupVariants}
        aria-hidden="true"
      >
        <motion.path
          id={`plus-1-${uniqueId}`}
          variants={iconVariants}
          d="M338.178 184.664V163.446L341.834 161.336V182.553L338.178 184.664ZM330.825 180.403V176.182L349.2 165.573V169.794L330.825 180.403Z"
          fill="#34D399"
        />
        <motion.path
          id={`plus-2-${uniqueId}`}
          variants={iconVariants}
          d="M338.178 219.265V198.048L341.834 195.937V217.155L338.178 219.265ZM330.825 215.005V210.783L349.2 200.174V204.396L330.825 215.005Z"
          fill="#34D399"
        />
        <motion.path
          id={`minus-${uniqueId}`}
          variants={iconVariants}
          d="M348.114 236.266V240.632L331.91 249.987V245.621L348.114 236.266Z"
          fill="#F87171"
        />
      </motion.g>

      <motion.g
        id={`indicator-${uniqueId}`}
        variants={indicatorVariants}
        aria-hidden="true"
      >
        <circle
          id={`ellipse-1-${uniqueId}`}
          cx="5.5"
          cy="5.5"
          r="5.5"
          transform="matrix(0.866025 0.5 -0.866025 0.5 176.211 88.7773)"
          fill="#DAB149"
        />
        <g id={`ellipse-2-${uniqueId}`} filter={`url(#${filterBlurId})`}>
          <circle
            cx="5.5"
            cy="5.5"
            r="5.5"
            transform="matrix(0.866025 0.5 -0.866025 0.5 176.211 88.7773)"
            fill="#DAB149"
          />
        </g>
      </motion.g>
    </motion.svg>
  );
}
