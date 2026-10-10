import { useState, useEffect } from 'react';

export default function useSmsListener() {
  const [smsList, setSmsList] = useState([]);
  
  useEffect(() => {
    // Only fetch from localStorage once on mount to initialize processed list
    const getProcessed = () => {
      try {
        return JSON.parse(localStorage.getItem('nwm_processed_sms') || '[]');
      } catch (e) {
        return [];
      }
    };

    const handleMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'SMS_SYNC') {
          const processed = getProcessed();
          const newSms = data.payload.filter(sms => !processed.includes(sms._id));
          // Further filter: only bank/transaction related SMS to avoid clutter?
          // E.g., check for keywords like 'debited', 'spent', 'rs.', 'inr', 'credited'
          const txSms = newSms.filter(sms => 
            /debited|credited|spent|rs\\.?|inr|payment|paid/i.test(sms.body)
          );
          setSmsList(txSms);
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const dismissSms = (id) => {
    try {
      const processed = JSON.parse(localStorage.getItem('nwm_processed_sms') || '[]');
      if (!processed.includes(id)) {
        processed.push(id);
        localStorage.setItem('nwm_processed_sms', JSON.stringify(processed));
      }
    } catch(e) {}
    setSmsList(prev => prev.filter(sms => sms._id !== id));
  };

  return { smsList, dismissSms };
}
