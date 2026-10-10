import { useEffect, useRef } from 'react';

export default function useModalBack(isOpen, closeFn) {
  const closeFnRef = useRef(closeFn);
  
  useEffect(() => {
    closeFnRef.current = closeFn;
  }, [closeFn]);

  useEffect(() => {
    if (isOpen) {
      window.modalCount = (window.modalCount || 0) + 1;
      if (window.modalCount > 0) {
        document.body.classList.add('has-modal');
      }
      window.location.hash = 'modal';
    } else {
      if (window.location.hash === '#modal') {
        window.history.back();
      }
    }

    const onHashChange = () => {
      if (window.location.hash !== '#modal' && isOpen) {
        closeFnRef.current();
      }
    };

    window.addEventListener('hashchange', onHashChange);
    
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      if (isOpen) {
        window.modalCount = Math.max(0, (window.modalCount || 1) - 1);
        if (window.modalCount === 0) {
          document.body.classList.remove('has-modal');
        }
      }
    };
  }, [isOpen]);
}
