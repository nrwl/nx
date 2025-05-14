import { useState, useRef, useEffect } from 'react';
import { Pill } from '../pill';
import { twMerge } from 'tailwind-merge';

interface OwnersListProps {
  owners: string[];
  className?: string;
}

export function OwnersList({ owners, className }: OwnersListProps) {
  const [isExpanded, _setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ownersContainerRef = useRef<HTMLSpanElement>(null);

  const checkOverflow = () => {
    requestAnimationFrame(() => {
      if (ownersContainerRef.current) {
        setIsOverflowing(
          ownersContainerRef.current.scrollWidth >
            ownersContainerRef.current.offsetWidth
        );
      }
    });
  };

  const setExpanded = (value: boolean) => {
    _setIsExpanded(value);
    checkOverflow();
  };

  useEffect(() => {
    checkOverflow();

    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [ownersContainerRef]);

  return (
    <div className={twMerge('relative max-w-full', className)}>
      <p className="flex min-w-0 font-medium leading-loose">
        <span className="inline-block">Owners:</span>

        <span
          className={`inline-block ${
            isExpanded ? 'whitespace-normal' : 'whitespace-nowrap'
          } w-full max-w-full overflow-hidden transition-all duration-300`}
          style={{
            maskImage:
              isOverflowing && !isExpanded
                ? 'linear-gradient(to right, black 80%, transparent 100%)'
                : 'none',
          }}
          ref={ownersContainerRef}
        >
          {owners.map((tag) => (
            <span key={tag} className="ml-2 font-mono lowercase">
              <Pill text={tag} />
            </span>
          ))}
          {isExpanded && (
            <button
              onClick={() => setExpanded(false)}
              className="inline-block px-2 align-middle"
            >
              Show less
            </button>
          )}
        </span>
        {isOverflowing && !isExpanded && (
          <button
            onClick={() => setExpanded(true)}
            className="ml-1 inline-block whitespace-nowrap"
          >
            Show more
          </button>
        )}
      </p>
    </div>
  );
}
