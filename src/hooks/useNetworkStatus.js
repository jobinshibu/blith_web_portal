import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const checkIsOnline = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    await fetch(`https://www.google.com/favicon.ico?_t=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return true;
  } catch (err) {
    // If external ping fails or times out, verify against origin
    try {
      const res = await fetch(`/?_t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      return res.ok || res.type === 'opaque';
    } catch {
      return false;
    }
  }
};

export function useNetworkStatus(showToast = true) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const checkStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    const realOnline = await checkIsOnline();
    setIsOnline(realOnline);
    return realOnline;
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      const confirmed = await checkIsOnline();
      setIsOnline(confirmed);
      if (confirmed && showToast) {
        toast.success('Internet connection restored.', {
          id: 'network-status',
          duration: 3000,
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (showToast) {
        toast.error('You are offline. Please check your internet connection.', {
          id: 'network-status',
          duration: 5000,
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    checkStatus();

    // Periodic heartbeat every 15 seconds to catch silent WiFi drops
    const intervalId = setInterval(checkStatus, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [showToast, checkStatus]);

  return { isOnline, checkIsOnline: checkStatus };
}

