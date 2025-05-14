import { ReactElement, useEffect, useState } from 'react';
import {
  motion,
  stagger,
  useAnimate,
  useInView,
  useReducedMotion,
  Variants,
} from 'framer-motion';
import { AnimationProps } from './animation.model';

/**
 * Ownership animation.
 *
 * @param {Object} props - The properties object.
 * @param {boolean} [props.autoPlay=true] - Determines whether the animation should start automatically.
 * @param {string} [props.className=''] - Additional class names to be applied to the SVG container.
 * @param {number} [props.inViewThreshold=0.3] - The intersection threshold to trigger animations.
 * @param {boolean} [props.once=false] - If true, the animation is triggered only once when the element enters the viewport.
 * @param {number} [props.speed=1] - Controls the speed of the animation; higher numbers make it faster.
 * @return {ReactElement} React component rendering the animated SVG structure.
 */
export function OwnershipAnimation({
  autoPlay = true,
  className = '',
  inViewThreshold = 0.3,
  once = false,
  speed = 1,
}: AnimationProps): ReactElement {
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope, {
    amount: inViewThreshold,
    once,
  });

  const getDuration = (base: number) => base / speed;
  const willChangeStyle = {
    willChange: 'opacity, transform, fill, pathLength',
  };
  const prefersReducedMotion = useReducedMotion();
  const [animationsCompleted, setAnimationsCompleted] = useState(false);

  // Animation sequence
  useEffect(() => {
    if (!isInView || animationsCompleted || !autoPlay) return;

    if (prefersReducedMotion) {
      // Single animate call with duration 0 for immediate final state
      const controls = animate(
        [
          ['.folder', { opacity: 1, y: 0 }],
          ['.folder-green', { fill: 'rgba(52, 211, 153, 0.3)' }],
          ['.folder-red', { fill: 'rgba(248, 113, 113, 0.3)' }],
          ['.zone-border', { pathLength: 1, opacity: 0.4 }],
          ['.zone-fill', { opacity: 0.05 }],
          ['.team-title', { opacity: 1, y: 0 }],
        ],
        {
          duration: 0,
          onComplete: () => setAnimationsCompleted(true),
          onError: (error: any) =>
            console.error('Applying final animation states failed:', error),
        }
      );

      return () => controls.stop();
    }

    // Animation starts
    const controls = animate(
      [
        // 1. Folders slide in from bottom (with staggered delay)
        [
          '.folder',
          { opacity: 1, y: 0 },
          {
            duration: getDuration(0.8),
            ease: 'easeOut',
            delay: stagger(getDuration(0.2)),
          },
        ],

        // 2. Color transitions for folders
        [
          '.folder-green',
          { fill: 'rgba(52, 211, 153, 0.3)' },
          {
            duration: getDuration(1.2),
            ease: 'easeInOut',
            delay: stagger(getDuration(0.2)),
            at: '<',
          },
        ],
        [
          '.folder-red',
          { fill: 'rgba(248, 113, 113, 0.3)' },
          {
            duration: getDuration(1.2),
            ease: 'easeInOut',
            delay: stagger(getDuration(0.2)),
            at: '<',
          },
        ],

        // 3. Team zone borders (starts after folders finish)
        [
          '.zone-border',
          { pathLength: 1, opacity: 0.4 },
          {
            duration: getDuration(1.5),
            ease: 'easeInOut',
            opacity: { duration: getDuration(0.5) },
          },
        ],

        // 4. Zone fill rectangles (starts after borders)
        [
          '.zone-fill',
          { opacity: 0.05 },
          { duration: getDuration(0.8), ease: 'easeIn' },
        ],

        // 5. Team titles (starts after fill)
        [
          '.team-title',
          { opacity: 1, y: 0 },
          { duration: getDuration(0.8), ease: 'easeOut' },
        ],
      ],
      {
        onComplete: () => setAnimationsCompleted(true),
      }
    );

    return () => controls.cancel();
  }, [isInView, prefersReducedMotion, autoPlay, animationsCompleted, speed]);

  const folderVariants: Variants = {
    initial: {
      opacity: 0,
      y: 20,
    },
  };
  const zonePathVariants: Variants = {
    initial: {
      pathLength: 0,
      opacity: 0,
    },
  };
  const zoneFillVariants: Variants = {
    initial: {
      opacity: 0,
    },
  };
  const titleVariants: Variants = {
    initial: {
      opacity: 0,
      y: -15,
    },
  };

  return (
    <motion.svg
      ref={scope}
      width="416"
      height="397"
      viewBox="0 0 416 397"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={willChangeStyle}
    >
      <g id="Ownership">
        <g id="Container">
          {/* Team 2 - Green folders */}
          <g id="Team_2">
            {/* Folder 1 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={0}
              variants={folderVariants}
            >
              <g id="Outline_2">
                <motion.path
                  className="folder-green"
                  d="M201.729 140.3c-1.036-.598-1.922-1.536-2.66-2.813-.737-1.276-1.106-2.514-1.107-3.712v-26.101c0-1.196.369-2.007 1.107-2.431.739-.425 1.625-.34 2.66.256l11.302 6.525 3.767 6.525 15.069 8.701c1.036.598 1.923 1.536 2.662 2.815.738 1.279 1.107 2.516 1.106 3.71v21.75c0 1.196-.369 2.008-1.106 2.435-.737.427-1.624.34-2.662-.26l-30.138-17.4Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.3"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M212.156 99.2204s.001 0-.078-.4675c-.266-.6746-.266-.6658-.266-.6658l.001-.0002.002-.0004.005-.001a.72026.72026 0 0 0 .018-.0031c.015-.0025.036-.0058.061-.0097.052-.0078.124-.0265.213-.0362.177-.0193.425-.0382.709-.0364.552.0034 1.474.1696 2.125.5443v.0003l11.441 6.6053 3.767 6.525 14.93 8.62c1.147.662 2.103 1.686 2.881 3.035.779 1.349 1.188 2.688 1.186 4.01v21.749c0 1.406-.758 2.579-1.684 3.116l-.601-1.037c.549-.318 1.087-1.091 1.087-2.079v-21.751c.001-1.066-.328-2.2-1.026-3.409-.698-1.209-1.516-2.062-2.442-2.596l-15.208-8.78-3.767-6.526-11.162-6.4441-.001-.0001c-.384-.2212-.933-.4175-1.407-.4205-.229-.0014-.429.0138-.572.0294-.071.0077-.127.0154-.164.021-.018.0027-.031.0049-.039.0063-.005.0007-.007.0012-.009.0014 0 .0001-.001.0002-.001.0002l.001-.0001v-.0001Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  d="M234.582 158.147L247.699 151.422"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  d="M199.161 104.943L212.078 98.6172"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  d="M232.053 127.185L244.77 120.727"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  d="M216.872 118.396L229.589 111.938"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  d="M212.61 111.869L225.328 105.41"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  d="M235.781 133.709L248.499 127.25"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
              </g>
              <motion.path
                className="folder-green"
                d="m212.357 98.6484-11.801 6.2246 12.32 6.874 4.02 6.873 16.21 9.467 2.075 2.853.389 2.982v23.733l10.764-5.577 2.334-2.204v-21.269l-.389-2.723-1.426-3.112-1.945-1.816-14.914-8.559-3.891-6.873-11.152-6.0955-2.594-.7781Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>
            {/* Folder 2 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={1}
              variants={folderVariants}
            >
              <g id="Outline_2_2">
                <motion.path
                  className="folder-green"
                  d="M248.982 171.136c-1.036-.598-1.922-1.536-2.66-2.813-.737-1.276-1.106-2.514-1.107-3.712V138.51c0-1.196.369-2.007 1.107-2.431.739-.425 1.625-.34 2.66.256l11.302 6.525 3.767 6.525 15.069 8.7c1.036.599 1.923 1.537 2.662 2.816.738 1.279 1.107 2.516 1.105 3.71v21.75c0 1.196-.368 2.008-1.105 2.435-.737.427-1.625.34-2.662-.26l-30.138-17.4Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.3"
                />
                <path
                  id="Vector (Stroke)_2"
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M259.408 130.056s.001 0-.078-.467c-.267-.675-.267-.666-.267-.666h.002l.002-.001.005-.001c.005 0 .011-.001.018-.003.015-.002.036-.006.061-.009.052-.008.124-.027.213-.037.177-.019.425-.038.709-.036.552.003 1.474.17 2.125.544v.001l11.441 6.605 3.767 6.525 14.93 8.62c1.147.662 2.103 1.686 2.881 3.035.779 1.349 1.188 2.688 1.186 4.01v21.749c0 1.406-.758 2.579-1.684 3.116l-.601-1.038c.548-.317 1.087-1.09 1.087-2.078v-21.751c.001-1.066-.328-2.2-1.026-3.409-.698-1.209-1.516-2.062-2.442-2.596l-15.208-8.781-3.767-6.525-11.162-6.444h-.001c-.384-.221-.933-.418-1.407-.421-.229-.001-.43.014-.572.03-.071.007-.127.015-.164.021-.018.002-.031.005-.04.006-.004.001-.006.001-.008.001l-.001.001.001-.001Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  id="Vector 52_2"
                  d="M281.835 188.983L294.952 182.258"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 53_2"
                  d="M279.306 158.021L292.023 151.562"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 55_2"
                  d="M264.124 149.232L276.841 142.773"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 56_2"
                  d="M259.863 142.705L272.581 136.246"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 57_2"
                  d="M246.413 135.778L259.33 129.453"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 54_2"
                  d="M283.034 164.544L295.751 158.086"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                />
              </g>
              <motion.path
                className="folder-green"
                d="m259.609 129.484-11.801 6.225 12.32 6.873 4.02 6.874 16.21 9.467 2.075 2.853.389 2.982v23.733l10.764-5.577 2.334-2.204v-21.269l-.389-2.723-1.426-3.112-1.945-1.816-14.914-8.559-3.891-6.873-11.152-6.096-2.594-.778Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>

            {/* Folder 3 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={2}
              variants={folderVariants}
            >
              <g id="Outline_2_3">
                <motion.path
                  className="folder-green"
                  d="M295.642 201.249c-1.036-.598-1.922-1.536-2.659-2.812-.738-1.277-1.107-2.515-1.108-3.713v-26.101c0-1.196.369-2.006 1.108-2.431.738-.425 1.625-.339 2.659.256l11.302 6.526 3.767 6.525 15.069 8.7c1.036.598 1.924 1.536 2.662 2.815s1.107 2.516 1.106 3.71v21.75c0 1.196-.369 2.008-1.106 2.435-.737.427-1.624.341-2.662-.26l-30.138-17.4Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.3"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M306.069 160.17s.001 0-.078-.468c-.266-.674-.266-.666-.266-.666h.003l.005-.001c.005-.001.011-.002.018-.003.015-.003.036-.006.061-.01.052-.008.124-.027.213-.036.177-.02.425-.038.709-.037.552.004 1.474.17 2.125.545l11.441 6.605 3.767 6.525 14.93 8.62c1.147.662 2.103 1.686 2.881 3.035.779 1.349 1.188 2.688 1.186 4.01v21.75c0 1.405-.757 2.578-1.684 3.115l-.6-1.037c.548-.318 1.086-1.091 1.086-2.078v-21.751c.001-1.067-.327-2.201-1.026-3.41-.698-1.209-1.516-2.061-2.442-2.596l-15.208-8.78-3.767-6.525-11.162-6.445h-.001c-.384-.221-.933-.418-1.407-.42-.229-.002-.429.013-.572.029-.071.008-.127.015-.163.021-.019.003-.032.005-.04.006-.004.001-.007.001-.009.002Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  id="Vector 52_3"
                  d="M328.495 219.096L341.612 212.371"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 53_3"
                  d="M325.966 188.134L338.683 181.676"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 55_3"
                  d="M310.784 179.345L323.501 172.887"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 56_3"
                  d="M306.522 172.818L319.24 166.359"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 57_3"
                  d="M293.073 165.892L305.99 159.566"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.2"
                />
                <path
                  id="Vector 54_3"
                  d="M329.694 194.658L342.412 188.199"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.2"
                />
              </g>
              <motion.path
                className="folder-green"
                d="m306.269 159.598-11.801 6.224 12.32 6.874 4.02 6.873 16.21 9.467 2.075 2.853.389 2.983v23.732l10.764-5.577 2.335-2.204v-21.268l-.389-2.724-1.427-3.112-1.945-1.816-14.914-8.559-3.89-6.873-11.153-6.095-2.594-.778Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>

            {/* Team 2 Zone - with drawing animation */}
            <g id="Zone">
              <motion.rect
                className="zone-fill"
                width="197.45"
                height="96.4706"
                rx="4.78977"
                transform="matrix(0.866025 0.5 0 1 185 61)"
                fill="rgba(52, 211, 153, 0.3)"
                initial="initial"
                variants={zoneFillVariants}
              />
              <motion.rect
                className="zone-border"
                x="-0.29629"
                y="-0.51319"
                width="198.135"
                height="97.1548"
                rx="5.1319"
                transform="matrix(0.866025 0.5 0 1 184.96 61.1481)"
                stroke="rgba(52, 211, 153, 1)"
                strokeOpacity="0.4"
                strokeWidth="0.7"
                initial="initial"
                variants={zonePathVariants}
              />
            </g>

            {/* Team 2 Title - with slide-in and fade-in animation */}
            <motion.path
              className="team-title"
              d="M188.005 48.7347V40.284L185.468 38.8193V37.6853L191.547 41.1952V42.3291L189.01 40.8644V49.3152L188.005 48.7347ZM195.05 52.8022V43.2175L200.1 46.1334V47.2674L196.055 44.9319V48.0233L199.96 50.2778V51.3847L196.055 49.1303V52.2487L200.194 54.6381V55.7721L195.05 52.8022ZM203.299 57.5649L205.824 49.4382L207.18 50.2211L209.706 61.2638L208.63 60.6428L206.502 50.8826L204.375 58.1859L203.299 57.5649ZM204.573 55.5737L204.924 54.6422L208.081 56.4647L208.431 57.8011L204.573 55.5737ZM215.056 63.2726L213.489 54.9433L213.582 54.9973V63.5021L212.577 62.9216V53.3369L214.097 54.2144L215.734 63.0431L215.266 62.7731L216.903 55.8343L218.423 56.7118V66.2965L217.417 65.716V57.2113L217.511 57.2653L215.944 63.7856L215.056 63.2726ZM230.572 73.311C230.572 72.636 230.662 72.0803 230.841 71.6438C231.028 71.2028 231.351 70.8676 231.811 70.6381C232.279 70.4131 232.926 70.2871 233.752 70.2601C234.134 70.2466 234.442 70.2083 234.676 70.1454C234.909 70.0824 235.081 69.9699 235.19 69.8079C235.299 69.6459 235.354 69.4029 235.354 69.0789C235.354 68.7459 235.291 68.4219 235.167 68.1069C235.042 67.7829 234.855 67.4769 234.605 67.1889C234.364 66.9055 234.06 66.658 233.693 66.4465C233.109 66.109 232.645 66.0167 232.302 66.1697C231.967 66.3272 231.757 66.7052 231.671 67.3037L230.619 66.6152C230.712 65.7332 231.024 65.1663 231.554 64.9143C232.084 64.6623 232.797 64.795 233.693 65.3125C234.262 65.641 234.75 66.0392 235.155 66.5072C235.56 66.9752 235.868 67.4814 236.078 68.0259C236.297 68.5659 236.406 69.1104 236.406 69.6594C236.406 70.1454 236.336 70.5278 236.195 70.8068C236.055 71.0768 235.817 71.2681 235.482 71.3806C235.155 71.4976 234.703 71.5651 234.126 71.5831C233.627 71.6011 233.206 71.6686 232.863 71.7856C232.528 71.907 232.271 72.0645 232.092 72.258C231.92 72.447 231.827 72.6585 231.811 72.8925L236.417 75.5519V76.6859L230.572 73.311Z"
              fill="#94A3B8"
              initial="initial"
              variants={titleVariants}
            />
          </g>

          {/* Team 1 - Red folders */}
          <g id="Team_1">
            {/* Folder 1 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={0}
              variants={folderVariants}
            >
              <g id="Outline_2_4">
                <motion.path
                  className="folder-red"
                  d="M80.2421 222.957c-1.2536-.724-2.3263-1.859-3.2183-3.403-.892-1.545-1.3387-3.043-1.3402-4.493v-31.582c0-1.448.4467-2.429 1.3402-2.943.8935-.514 1.9662-.41 3.2183.311l13.6756 7.895 4.5585 7.896 18.2338 10.527c1.254.724 2.327 1.86 3.221 3.407.893 1.548 1.339 3.044 1.338 4.489v26.319c0 1.447-.446 2.429-1.338 2.946-.892.517-1.966.412-3.221-.315l-36.4679-21.054Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.3"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M92.8587 173.25s.0003 0-.095-.565c-.3223-.817-.3223-.806-.3223-.806h.0014l.0024-.001.0069-.001c.0054-.001.0127-.002.0217-.004.0179-.003.0427-.007.0738-.012.062-.009.1498-.032.2574-.043.2146-.024.5141-.047.8581-.044.6673.004 1.7837.205 2.5708.658l.0007.001 13.8434 7.992 4.559 7.896 18.066 10.43c1.387.801 2.543 2.04 3.486 3.673.942 1.632 1.436 3.252 1.435 4.851v26.318c0 1.701-.917 3.121-2.038 3.77l-.727-1.255c.663-.384 1.315-1.32 1.315-2.515v-26.319c.001-1.29-.397-2.662-1.241-4.125-.845-1.463-1.835-2.495-2.955-3.142l-18.403-10.625-4.558-7.895-13.5069-7.798h-.0003c-.4649-.268-1.1295-.506-1.7032-.509-.2766-.002-.5194.017-.692.035-.0859.01-.1534.019-.1977.026-.0222.003-.0385.006-.0483.007-.005.001-.0083.002-.0099.002h-.0011.0011Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  id="Vector 52_4"
                  d="M119.995 244.551L135.867 236.414"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  id="Vector 53_4"
                  d="M116.935 207.085L132.323 199.27"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.4"
                />
                <path
                  id="Vector 55_4"
                  d="M98.5654 196.452L113.954 188.637"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.4"
                />
                <path
                  id="Vector 56_4"
                  d="M93.4082 188.557L108.797 180.742"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.4"
                />
                <path
                  id="Vector 57_4"
                  d="M77.1348 180.177L92.7648 172.523"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  id="Vector 54_4"
                  d="M121.446 214.983L136.835 207.168"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeOpacity="0.5"
                  strokeWidth="1.4"
                />
              </g>
              <motion.path
                className="folder-red"
                d="m93.1022 172.559-14.2799 7.532 14.9076 8.317 4.8646 8.317L118.21 208.18l2.511 3.452.47 3.609v28.717l13.025-6.747 2.824-2.668v-25.735l-.47-3.296-1.726-3.766-2.354-2.197-18.046-10.357-4.708-8.317-13.4954-7.375-3.1384-.941Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>

            {/* Folder 2 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={1}
              variants={folderVariants}
            >
              <g id="Outline_2_5">
                <motion.path
                  className="folder-red"
                  d="M137.42 260.273c-1.254-.724-2.327-1.858-3.218-3.403-.892-1.545-1.339-3.042-1.341-4.493v-31.582c0-1.448.447-2.428 1.341-2.942.893-.515 1.966-.411 3.218.31l13.675 7.896 4.559 7.895 18.234 10.528c1.254.724 2.327 1.859 3.221 3.407.893 1.547 1.339 3.043 1.338 4.488v26.319c0 1.448-.446 2.43-1.338 2.946-.892.517-1.966.412-3.221-.314l-36.468-21.055Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.61135"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M150.037 210.567s.001 0-.095-.566c-.322-.816-.322-.806-.322-.806h.004l.007-.002c.005-.001.013-.002.021-.003.018-.003.043-.008.074-.012.062-.01.15-.032.258-.044.214-.023.514-.046.858-.044.667.004 1.783.205 2.571.659l13.844 7.993 4.559 7.895 18.065 10.431c1.387.8 2.544 2.04 3.486 3.672.943 1.632 1.437 3.253 1.436 4.852v26.318c0 1.7-.917 3.12-2.038 3.769l-.727-1.255c.663-.384 1.314-1.32 1.314-2.514v-26.32c.002-1.29-.396-2.662-1.24-4.125-.845-1.463-1.835-2.495-2.956-3.142l-18.402-10.624-4.559-7.896-13.506-7.798c-.465-.268-1.13-.505-1.704-.509-.276-.001-.519.017-.692.036-.086.009-.153.019-.197.025-.023.004-.039.006-.049.008-.005.001-.008.001-.01.002h-.001.001Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  d="M177.173 281.868L193.045 273.73"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  d="M174.112 244.401L189.501 236.586"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M155.742 233.768L171.131 225.953"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M150.586 225.874L165.974 218.059"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M134.312 217.494L149.942 209.84"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  d="M178.624 252.299L194.012 244.484"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
              </g>
              <motion.path
                className="folder-red"
                d="m150.279 209.875-14.28 7.532 14.908 8.317 4.864 8.317 19.616 11.455 2.51 3.453.471 3.609v28.717l13.025-6.748 2.824-2.668v-25.735l-.471-3.295-1.726-3.766-2.354-2.197-18.046-10.357-4.707-8.317-13.496-7.375-3.138-.942Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>

            {/* Folder 3 */}
            <motion.g
              className="folder"
              initial="initial"
              custom={2}
              variants={folderVariants}
            >
              <g id="Outline_2_6">
                <motion.path
                  className="folder-red"
                  d="M193.881 296.707c-1.254-.724-2.327-1.859-3.219-3.403-.891-1.545-1.338-3.043-1.34-4.493v-31.582c0-1.448.447-2.429 1.34-2.943.894-.514 1.967-.41 3.219.311l13.675 7.895 4.559 7.896 18.234 10.527c1.254.724 2.327 1.86 3.221 3.407.893 1.548 1.339 3.044 1.337 4.489v26.319c0 1.447-.445 2.429-1.337 2.946-.892.517-1.966.412-3.221-.315l-36.468-21.054Z"
                  fill="rgba(241, 245, 249, 0.3)"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.6"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M206.498 247s.001 0-.095-.565c-.322-.817-.322-.806-.322-.806h.001l.003-.001.007-.001c.005-.001.012-.002.021-.004.018-.003.043-.007.074-.012.062-.009.15-.032.258-.043.214-.024.514-.047.858-.044.667.004 1.783.205 2.571.658v.001l13.844 7.992 4.559 7.896 18.065 10.43c1.387.801 2.544 2.04 3.486 3.673.943 1.632 1.437 3.252 1.435 4.851v26.318c0 1.701-.916 3.121-2.037 3.77l-.727-1.255c.663-.384 1.314-1.32 1.314-2.515v-26.319c.002-1.29-.396-2.662-1.241-4.125-.844-1.463-1.834-2.495-2.955-3.142l-18.402-10.625-4.559-7.895-13.506-7.798h-.001c-.464-.268-1.129-.506-1.703-.509-.276-.002-.519.017-.692.035-.086.01-.153.019-.197.026-.023.003-.039.006-.049.007-.005.001-.008.002-.01.002h-.001.001Z"
                  fill="rgba(241, 245, 249, 1)"
                />
                <path
                  d="M233.634 318.301L249.506 310.164"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  d="M230.573 280.835L245.962 273.02"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M212.203 270.202L227.591 262.387"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M207.047 262.307L222.435 254.492"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
                <path
                  d="M190.772 253.927L206.403 246.273"
                  stroke="rgba(241, 245, 249, 1)"
                  strokeWidth="1.4"
                />
                <path
                  d="M235.085 288.733L250.473 280.918"
                  stroke="rgba(241, 245, 249, 0.5)"
                  strokeWidth="1.4"
                />
              </g>
              <motion.path
                className="folder-red"
                d="m206.74 246.309-14.28 7.532 14.908 8.317 4.864 8.317 19.615 11.455 2.511 3.452.471 3.609v28.717l13.025-6.747 2.824-2.668v-25.735l-.471-3.296-1.726-3.766-2.354-2.197-18.046-10.357-4.707-8.317-13.496-7.375-3.138-.941Z"
                fill="rgba(241, 245, 249, 0.3)"
              />
            </motion.g>

            {/* Team 1 Zone - with drawing animation */}
            <g id="Zone_2">
              <motion.rect
                className="zone-fill"
                width="239.75"
                height="117.561"
                rx="6.20978"
                transform="matrix(0.866025 0.5 0 1 60 127)"
                fill="rgba(248, 113, 113, 1)"
                initial="initial"
                variants={zoneFillVariants}
              />
              <motion.rect
                className="zone-border"
                x="-0.358522"
                y="-0.620978"
                width="239.75"
                height="117.561"
                rx="6.20978"
                transform="matrix(0.866025 0.5 0 1 59.952 127.179)"
                stroke="rgba(248, 113, 113, 1)"
                strokeWidth="0.7"
                initial="initial"
                variants={zonePathVariants}
              />
            </g>

            {/* Team 1 Title - with slide-in and fade-in animation */}
            <motion.path
              className="team-title"
              d="M64.0046 119.735V111.284L61.4676 109.819V108.685L67.5469 112.195V113.329L65.01 111.864V120.315L64.0046 119.735ZM71.0497 123.802V114.217L76.1002 117.133V118.267L72.0551 115.932V119.023L75.9599 121.278V122.385L72.0551 120.13V123.249L76.1937 125.638V126.772L71.0497 123.802ZM79.2989 128.565L81.8242 120.438L83.1804 121.221L85.7056 132.264L84.63 131.643L82.5023 121.883L80.3745 129.186L79.2989 128.565ZM80.5733 126.574L80.924 125.642L84.0806 127.465L84.4313 128.801L80.5733 126.574ZM91.0555 134.273L89.4889 125.943L89.5824 125.997V134.502L88.577 133.922V124.337L90.0968 125.214L91.7336 134.043L91.2659 133.773L92.9027 126.834L94.4225 127.712V137.296L93.4171 136.716V128.211L93.5106 128.265L91.944 134.786L91.0555 134.273ZM109.308 145.89V138.79L107.133 137.534V136.535L108.255 137.183C108.552 137.354 108.789 137.442 108.969 137.446C109.156 137.455 109.288 137.374 109.366 137.203C109.452 137.037 109.495 136.774 109.495 136.414L110.313 136.886V146.471L109.308 145.89ZM106.689 144.379V143.245L112.301 146.484V147.618L106.689 144.379Z"
              fill="#94A3B8"
              initial="initial"
              variants={titleVariants}
            />
          </g>
        </g>
      </g>
    </motion.svg>
  );
}
