import { useEffect } from 'react';

export default function useModalBack(isOpen, closeFn) {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-modal');
      window.location.hash = 'modal';
    } else {
      document.body.classList.remove('has-modal');
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
    return () => {
      document.body.classList.remove('has-modal');
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [isOpen, closeFn]);
}
