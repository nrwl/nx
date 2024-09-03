import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface VideoPopupProps {
  videoId: string;
  onClose: () => void;
}

export function VideoPopup({ videoId, onClose }: VideoPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        event.target instanceof Node &&
        !popupRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    const handleMouseDown = (event: globalThis.MouseEvent) => {
      handleClickOutside(event);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  // Render the popup using a portal
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[6] flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={popupRef}
        className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800"
      >
        <div className="relative w-[80vw] max-w-[800px] pt-[56.25%]">
          <iframe
            className="absolute left-0 top-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </div>,
    document.body // Mount the popup at the top level of the DOM
  );
}
