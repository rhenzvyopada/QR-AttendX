import { useCallback, useSyncExternalStore } from 'react';

import { eventBus, type EventName, type EventBusPayload } from './attendance';

/**
 * React hook that exposes the app's event bus so screens can subscribe to
 * domain events.
 *
 * A screen calls `const { on } = useEventBus()` and then can do:
 *
 *   on('attendanceRecorded', ({ eventTitle }) => setFeedback(...));
 *
 * Each subscription returns an unsubscribe function, so a screen that leaves
 * (e.g. a tab focus effect) can tear down its listeners.
 */
export function useEventBus() {
  const subscribe = useCallback(() => {
    return eventBus.on('dataRefreshed', () => {});
  }, []);

  const state = useSyncExternalStore(subscribe, () => ({}), () => ({}));

  // `on` and `off` are stable closures that the caller can keep and tear down.
  return {
    on: <K extends EventName>(
      name: K,
      handler: (payload: EventBusPayload) => void
    ) => eventBus.on(name, handler as never),
    off: <K extends EventName>(
      name: K,
      handler: (payload: EventBusPayload) => void
    ) => eventBus.off(name, handler as never),
  };
}
