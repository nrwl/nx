import React, { useState, useRef, useEffect } from 'react';
import { Pill } from '../pill';
import { twMerge } from 'tailwind-merge';

interface TagListProps {
  tags: string[];
  className: string;
}

export function TagList({ tags, className }: TagListProps) {
  const [isExpanded, _setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const tagsContainerRef = useRef<HTMLSpanElement>(null);

  const checkOverflow = () => {
    requestAnimationFrame(() => {
      if (tagsContainerRef.current) {
        setIsOverflowing(
          tagsContainerRef.current.scrollWidth >
            tagsContainerRef.current.offsetWidth
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
  }, [tagsContainerRef]);

  return (
    <div className={twMerge('relative max-w-full', className)}>
      <p className="flex min-w-0 font-medium leading-loose">
        <span className="inline-block">Tags:</span>

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
          ref={tagsContainerRef}
        >
          {tags.map((tag) => (
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
