import { useEffect } from 'react';

export default function useModalBack(isOpen, closeFn) {
  useEffect(() => {
    if (isOpen) {
      window.location.hash = 'modal';
    } else {
      if (window.location.hash === '#modal') {
        window.history.back();
      }
    }

    const onHashChange = () => {
      if (window.location.hash !== '#modal' && isOpen) {
        closeFn();
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isOpen, closeFn]);
}
