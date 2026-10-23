import { useSyncExternalStore } from 'react';
import { eventBus } from './attendance';

// A simple counter to force React to re-render
let version = 0;

export function useDataRefreshed() {
  const subscribe = (callback: () => void) => {
    // When dataRefreshed fires, we increment version and tell React to re-render
    const unsubscribe = eventBus.on('dataRefreshed', () => {
      version++;
      callback(); 
    });
    return unsubscribe; // React needs this to clean up
  };

  const getSnapshot = () => version;

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}