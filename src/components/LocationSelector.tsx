import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocationStore } from '@/store/location.store';

const LocationSelector = () => {
  const { t } = useTranslation();
  const { currentLocationId, locations, setCurrentLocation } = useLocationStore();

  if (locations.length === 0) {
    return <span className="lbl">{t('common.loading')}</span>;
  }

  return (
    <>
      <span className="lbl" id="location-selector-label">{t('components.factorySelect')}</span>
      <Segmented
        aria-labelledby="location-selector-label"
        value={currentLocationId ?? undefined}
        onChange={(locationId) => {
          const loc = locations.find((l) => l.location_id === locationId);
          if (loc) setCurrentLocation(loc.location_id, loc.location_code);
        }}
        options={locations.map((loc) => ({ value: loc.location_id, label: loc.location_code }))}
      />
    </>
  );
};

export default LocationSelector;
