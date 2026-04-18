import i18n from '@/i18n/config';
import { useLocationStore } from '@/store/location.store';

export function getLocationId(): string {
  const { currentLocationId } = useLocationStore.getState();
  if (!currentLocationId) {
    throw new Error(i18n.t('errors.location.notSelected'));
  }
  return currentLocationId;
}

export function getLocationCode(): string {
  const { currentLocationCode } = useLocationStore.getState();
  if (!currentLocationCode) {
    throw new Error(i18n.t('errors.location.notSelected'));
  }
  return currentLocationCode;
}

export function getOptionalLocationId(): string | null {
  const { currentLocationId } = useLocationStore.getState();
  return currentLocationId;
}
