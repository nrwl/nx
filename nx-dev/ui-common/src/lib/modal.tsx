'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import cx from 'classnames';
import { ReactNode, useEffect, useRef, useState } from 'react';

function useEventListener(
  eventName: string,
  handler: Function,
  element = globalThis
) {
  // Create a ref that stores handler
  const savedHandler = useRef<Function>();

  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in effect deps array ...
  // ... and potentially cause effect to re-run every render.
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(
    () => {
      // Make sure element supports addEventListener
      // On
      const isSupported = element && element.addEventListener;
      if (!isSupported) return;

      // Create event listener that calls handler function stored in ref
      const eventListener = (event: Event) =>
        savedHandler.current && savedHandler.current(event);

      // Add event listener
      element.addEventListener(eventName, eventListener);

      // Remove event listener on cleanup
      return () => {
        element.removeEventListener(eventName, eventListener);
      };
    },
    [eventName, element] // Re-run if eventName or element changes
  );
}

export function ModalHeader({
  onClose,
  children,
}: {
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-slate-600">
      <div>{children}</div>
      <button
        type="button"
        className="text-slate-400 bg-transparent hover:bg-slate-200 hover:text-slate-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-slate-600 dark:hover:text-white"
        onClick={onClose}
      >
        <XMarkIcon className="h-5 w-5" />
        <span className="sr-only">Close modal</span>
      </button>
    </div>
  );
}
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center p-4 md:p-5 border-t border-slate-200 rounded-b dark:border-slate-600">
      {children}
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  children: ReactNode;
}) {
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === '27' || event.key === 'Escape') {
      onClose && onClose();
    }
  });
  return (
    <div
      tabIndex={isOpen ? 1 : -1}
      aria-hidden="true"
      onClick={onClose}
      className={cx(
        isOpen ? '' : 'hidden',
        'overflow-y-auto overflow-x-hidden fixed flex top-0 right-0 left-0 bottom-0 z-50 justify-center items-center w-full md:inset-0 h-full max-h-full bg-slate-800/40 dark:bg-slate-200/40'
      )}
    >
      <div className="relative p-4 w-full max-w-4xl max-h-full">
        <div className="relative bg-slate-50 rounded-lg shadow dark:bg-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
}
