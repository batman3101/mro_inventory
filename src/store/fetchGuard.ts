import { getOptionalLocationId } from '@/services/locationContext';

// Zustand stores live for the whole session, but pages remount on a factory
// switch. A slow response for the previous factory must not overwrite the
// newer one, and rows of the previous factory must not linger on screen.
export function createFetchGuard() {
  let latestId = 0;
  let lastLocationId: string | null = null;

  return {
    start() {
      latestId += 1;
      const locationId = getOptionalLocationId();
      const locationChanged = locationId !== lastLocationId;
      lastLocationId = locationId;
      return { id: latestId, locationChanged };
    },
    isLatest(request: { id: number }) {
      return request.id === latestId;
    },
  };
}
