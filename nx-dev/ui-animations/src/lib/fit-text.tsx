import { useInView } from 'framer-motion';
import { ComponentRef, ReactNode, useEffect, useRef } from 'react';
import { cx } from '@nx/nx-dev/ui-primitives';

/**
 * Resizes the text to fit within its container.
 *
 * @param {Object} props - The component's properties.
 * @param {ReactNode} props.children - The content to be displayed within the component.
 * @param {string} [props.className=''] - The additional className to be applied to the component.
 *
 * @return {JSX.Element} - The rendered component.
 */
export function FitText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const containerRef = useRef<ComponentRef<'div'>>(null);
  const textRef = useRef<ComponentRef<'span'>>(null);
  const isInView = useInView(containerRef);

  useEffect(() => {
    if (!isInView) return;
    resizeText();
    window.addEventListener('resize', resizeText);
    return () => {
      window.removeEventListener('resize', resizeText);
    };
  }, [isInView, children]);

  const resizeText = () => {
    const container = containerRef.current;
    const text = textRef.current;

    if (!container || !text) {
      return;
    }

    const containerWidth = container.offsetWidth;
    let min = 1;
    let max = 2500;

    while (min <= max) {
      const mid = Math.floor((min + max) / 2);
      text.style.fontSize = mid + 'px';

      if (text.offsetWidth <= containerWidth) {
        min = mid + 1;
      } else {
        max = mid - 1;
      }
    }

    text.style.fontSize = max + 'px';
  };

  return (
    <span
      className="relative grid h-full w-full grid-cols-1 place-items-center"
      ref={containerRef}
    >
      <span
        className={cx(
          'transform whitespace-nowrap text-center font-bold',
          className
        )}
        ref={textRef}
      >
        {children}
      </span>
    </span>
  );
}
