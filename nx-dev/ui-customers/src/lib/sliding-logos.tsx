import { useState, useEffect, SVGProps, FC } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

interface SlidingLogosProps {
  logos: {
    SVGComponent: FC<SVGProps<SVGSVGElement>>;
    height: string;
    width: string;
  }[];
  logoTimeOut?: number;
  currentLogoIndex?: number;
  setCurrentLogoIndex?: (index: number) => void;
}

const SlidingLogos: FC<SlidingLogosProps> = ({
  logos,
  logoTimeOut = 12000,
  currentLogoIndex,
  setCurrentLogoIndex = () => {},
}) => {
  const [isFirstSet, setIsFirstSet] = useState(true);

  // Update this effect to depend on the `currentLogoIndex` prop its best to use the passed down prop which is updated already based on a timer in the parent component
  // Ideal use-case is to only use 1 timer to manage the same functionality
  useEffect(() => {
    const logoCount = logos.length || 1; // Avoid division by zero
    const SLIDE_INTERVAL = Math.max((logoCount / 2) * logoTimeOut, 12000);
    const _interval = setInterval(() => {
      setIsFirstSet((prev) => !prev);
    }, SLIDE_INTERVAL);

    return () => clearInterval(_interval);
  }, [logos, logoTimeOut]);

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
      <AnimatePresence initial={false} custom={isFirstSet ? 1 : -1}>
        {isFirstSet ? (
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
                onClick={() => setCurrentLogoIndex(i)}
                key={`firstSet-logo-${i}`}
                className={`relative flex h-full w-full items-center justify-center ${
                  i === currentLogoIndex ? 'text-slate-950' : ''
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
                onClick={() => setCurrentLogoIndex(i)}
                key={`secondSet-logo-${i}`}
                className={`relative flex items-center justify-center ${
                  i + logoSet2.length === currentLogoIndex
                    ? 'text-slate-950'
                    : ''
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

export default SlidingLogos;
