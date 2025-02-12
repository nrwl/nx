'use client';
import { FC, RefObject, useEffect, useId, useState } from 'react';
import { motion, TargetAndTransition } from 'framer-motion';
import { cx } from '@nx/nx-dev/ui-primitives';

export interface AnimatedCurvedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement>; // Container ref
  fromRef: RefObject<HTMLElement>;
  toRef: RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  bidirectional?: boolean;
}

type BeamAnimation = {
  x1: [string, string];
  x2: [string, string];
  y1: [string, string];
  y2: [string, string];
};

export const AnimatedCurvedBeam: FC<AnimatedCurvedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false, // Include the reverse prop
  duration = Math.random() * 3 + 8,
  delay = 0,
  pathColor = 'gray',
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = '#ffaa40',
  gradientStopColor = '#9c40ff',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  bidirectional = false,
}) => {
  const id = useId();
  const [pathD, setPathD] = useState('');
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Calculate the gradient coordinates based on the reverse prop
  const forwardAnimation: BeamAnimation = {
    x1: reverse ? ['90%', '-10%'] : ['10%', '110%'],
    x2: reverse ? ['100%', '0%'] : ['0%', '100%'],
    y1: ['0%', '0%'],
    y2: ['0%', '0%'],
  };

  const backwardAnimation: BeamAnimation = {
    x1: reverse ? ['-10%', '90%'] : ['110%', '10%'],
    x2: reverse ? ['0%', '100%'] : ['100%', '0%'],
    y1: ['0%', '0%'],
    y2: ['0%', '0%'],
  };

  const animateValue: TargetAndTransition = bidirectional
    ? {
        x1: [
          forwardAnimation.x1[0],
          forwardAnimation.x1[1],
          backwardAnimation.x1[1],
          backwardAnimation.x1[0],
        ],
        x2: [
          forwardAnimation.x2[0],
          forwardAnimation.x2[1],
          backwardAnimation.x2[1],
          backwardAnimation.x2[0],
        ],
        y1: ['0%', '0%', '0%', '0%'],
        y2: ['0%', '0%', '0%', '0%'],
      }
    : forwardAnimation;

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rectA = fromRef.current.getBoundingClientRect();
        const rectB = toRef.current.getBoundingClientRect();

        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

        const controlY = startY - curvature;
        const d = `M ${startX},${startY} Q ${
          (startX + endX) / 2
        },${controlY} ${endX},${endY}`;
        setPathD(d);
      }
    };

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      // For all entries, recalculate the path
      for (let entry of entries) {
        updatePath();
      }
    });

    // Observe the container element
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Call the updatePath initially to set the initial path
    updatePath();

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cx(
        'pointer-events-none absolute left-0 top-0 transform-gpu stroke-2',
        className
      )}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits={'userSpaceOnUse'}
          initial={{
            x1: '0%',
            x2: '0%',
            y1: '0%',
            y2: '0%',
          }}
          animate={animateValue}
          transition={{
            delay,
            duration: bidirectional ? duration * 2 : duration,
            ease: [0.16, 1, 0.3, 1], // https://easings.net/#easeOutExpo
            repeat: Infinity,
            repeatDelay: 0,
          }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
};

export interface AnimatedAngledBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement>;
  fromRef: RefObject<HTMLElement>;
  toRef: RefObject<HTMLElement>;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  bidirectional?: boolean;
}

export const AnimatedAngledBeam: FC<AnimatedAngledBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  reverse = false,
  duration = Math.random() * 3 + 8,
  delay = 0,
  pathColor = '#cbd5e1',
  pathWidth = 2,
  pathOpacity = 1,
  gradientStartColor = '#ffaa40',
  gradientStopColor = '#9c40ff',
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  bidirectional = false,
}) => {
  const id = useId();
  const [pathD, setPathD] = useState('');
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const [totalLength, setTotalLength] = useState(0);

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const fromRect = fromRef.current.getBoundingClientRect();
        const toRect = toRef.current.getBoundingClientRect();

        const svgWidth = containerRect.width;
        const svgHeight = containerRect.height;
        setSvgDimensions({ width: svgWidth, height: svgHeight });

        const startX =
          fromRect.left -
          containerRect.left +
          fromRect.width / 2 +
          startXOffset;
        const startY =
          fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
        const endX =
          toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
        const endY =
          toRect.top - containerRect.top + toRect.height / 2 + endYOffset;

        // Create a path with 90-degree angles
        const midY = (startY + endY) / 2;
        const d = `M ${startX},${startY} V ${midY} H ${endX} V ${endY}`;
        setPathD(d);

        // Calculate total length of the path
        const tempPath = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path'
        );
        tempPath.setAttribute('d', d);
        setTotalLength(tempPath.getTotalLength());
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        updatePath();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    updatePath();

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    containerRef,
    fromRef,
    toRef,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cx(
        'pointer-events-none absolute left-0 top-0 transform-gpu stroke-2',
        className
      )}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
        strokeDasharray={totalLength}
        strokeDashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          values={
            bidirectional
              ? `${reverse ? -totalLength : totalLength};${
                  reverse ? totalLength : -totalLength
                };${reverse ? -totalLength : totalLength}`
              : `${reverse ? -totalLength : totalLength};${
                  reverse ? totalLength : -totalLength
                }`
          }
          dur={`${bidirectional ? duration * 2 : duration}s`}
          repeatCount="indefinite"
        />
      </path>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse">
          <stop stopColor={gradientStartColor} stopOpacity="0" offset="0%" />
          <stop stopColor={gradientStartColor} offset="10%" />
          <stop stopColor={gradientStopColor} offset="90%" />
          <stop stopColor={gradientStopColor} stopOpacity="0" offset="100%" />
        </linearGradient>
      </defs>
    </svg>
  );
};
