import Router from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export function useNavToggle() {
  const [navIsOpen, setNavIsOpen] = useState(false);
  const toggleNav = useCallback(() => {
    setNavIsOpen(!navIsOpen);
  }, [navIsOpen, setNavIsOpen]);

  useEffect(() => {
    if (!navIsOpen) return;

    function handleRouteChange() {
      setNavIsOpen(false);
    }

    Router.events.on('routeChangeComplete', handleRouteChange);

    return () => Router.events.off('routeChangeComplete', handleRouteChange);
  }, [navIsOpen, setNavIsOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!navIsOpen) return;

    function hideNav() {
      setNavIsOpen(false);
    }

    window.addEventListener('resize', hideNav);
    return () => window.removeEventListener('resize', hideNav);
  }, [navIsOpen, setNavIsOpen]);

  return { navIsOpen, toggleNav };
}
