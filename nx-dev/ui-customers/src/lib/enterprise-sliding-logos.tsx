import { SVGProps, FC } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

interface EnterpriseSlidingLogosProps {
  logos: {
    SVGComponent: FC<SVGProps<SVGSVGElement>>;
    height: string;
    width: string;
  }[];
  currentLogoIndex?: number;
  isFirstSetVisible?: boolean;
  setCurrentLogoIndex?: (index: number) => void;
}

const EnterpriseSlidingLogos: FC<EnterpriseSlidingLogosProps> = ({
  logos,
  currentLogoIndex,
  isFirstSetVisible,
  setCurrentLogoIndex = () => {},
}) => {
  function updateCurrentLogoIndex(index: number, set: number) {
    // If it is the second set we need to add half of the length to set the index correctly
    set > 1
      ? setCurrentLogoIndex(index + logos.length / 2)
      : setCurrentLogoIndex(index);
  }

  if (!logos.length) {
    return <></>;
  }

  const slideVariants: Variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  const logoSet1 = logos.slice(0, logos.length / 2);
  const logoSet2 = logos.slice(logos.length / 2);

  return (
    <div className="relative h-full w-full">
      <AnimatePresence initial={false} custom={isFirstSetVisible ? 1 : -1}>
        {isFirstSetVisible ? (
          <motion.div
            key="first"
            custom={1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5 }}
            className="absolute grid h-full w-full grid-cols-3 items-center justify-items-center"
          >
            {logoSet1.map(({ SVGComponent, height, width }, i) => (
              <button
                onClick={() => updateCurrentLogoIndex(i, 1)}
                key={`firstSet-logo-${i}`}
                className={`relative flex h-full w-full items-center justify-center transition-all ${
                  i === currentLogoIndex
                    ? 'text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-300'
                    : 'text-slate-400 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-500'
                }`}
              >
                <SVGComponent
                  key={`firstSet-icon-${i}`}
                  className={`${height} ${width} transition-transform duration-300`}
                />
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="second"
            custom={-1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5 }}
            className="absolute grid h-full w-full grid-cols-3 items-center justify-items-center"
          >
            {logoSet2.map(({ SVGComponent, height, width }, i) => (
              <button
                onClick={() => updateCurrentLogoIndex(i, 2)}
                key={`secondSet-logo-${i}`}
                className={`relative flex items-center justify-center transition-all ${
                  i + logoSet2.length === currentLogoIndex
                    ? 'text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-300'
                    : 'text-slate-400 hover:text-slate-500 dark:text-slate-700 dark:hover:text-slate-500'
                }`}
              >
                <SVGComponent
                  key={`secondSet-icon-${i}`}
                  className={`${height} ${width} transition-transform duration-300`}
                />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnterpriseSlidingLogos;
