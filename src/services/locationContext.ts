import { useLocationStore } from '@/store/location.store';

export function getLocationId(): string {
  const { currentLocationId } = useLocationStore.getState();
  if (!currentLocationId) {
    throw new Error('위치가 선택되지 않았습니다.');
  }
  return currentLocationId;
}

export function getLocationCode(): string {
  const { currentLocationCode } = useLocationStore.getState();
  if (!currentLocationCode) {
    throw new Error('위치가 선택되지 않았습니다.');
  }
  return currentLocationCode;
}

export function getOptionalLocationId(): string | null {
  const { currentLocationId } = useLocationStore.getState();
  return currentLocationId;
}
