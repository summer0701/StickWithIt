import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

export function useDisableNativeBackButton(enabled = true) {
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let removeListener: (() => void) | undefined;

    CapacitorApp.addListener('backButton', () => {
      // Registering this listener intentionally consumes Android hardware back.
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }
      removeListener = () => {
        void listener.remove();
      };
    }).catch((error) => {
      console.debug('[useDisableNativeBackButton] Failed to register back button listener.', error);
    });

    return () => {
      active = false;
      removeListener?.();
    };
  }, [enabled]);
}
