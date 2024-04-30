import Image from 'next/image';
import { useEffect, useState } from 'react';

export interface ImageThemeProps {
  lightSrc: string;
  darkSrc: string;
  alt?: string;
  [key: string]: any;
}

export function ImageTheme({
  lightSrc,
  darkSrc,
  alt,
  ...props
}: ImageThemeProps) {
  const [src, setSrc] = useState(lightSrc);

  // Listen for theme change and update the image
  useEffect(() => {
    const updateImageSource = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setSrc(isDarkMode ? darkSrc : lightSrc);
    };

    updateImageSource();

    // Event listener for changes in system theme
    const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    themeMediaQuery.addEventListener('change', updateImageSource);

    const observer = new MutationObserver(updateImageSource);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Cleanup function to remove event listener and observer on component unmount
    return () => {
      themeMediaQuery.removeEventListener('change', updateImageSource);
      observer.disconnect();
    };
  }, []);

  return <Image src={src} alt={alt ?? ''} {...props} />;
}
