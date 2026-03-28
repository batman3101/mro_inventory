import { Select } from 'antd';
import { useLocationStore } from '@/store/location.store';

const LocationSelector = () => {
  const { currentLocationId, locations, setCurrentLocation } = useLocationStore();

  const options = locations.map((loc) => ({
    value: loc.location_id,
    label: loc.location_name,
  }));

  const handleChange = (locationId: string) => {
    const loc = locations.find((l) => l.location_id === locationId);
    setCurrentLocation(locationId, loc?.location_code ?? '');
  };

  return (
    <Select
      value={currentLocationId ?? undefined}
      onChange={handleChange}
      options={options}
      placeholder="위치 선택"
      size="small"
      style={{ width: '100%' }}
    />
  );
};

export default LocationSelector;
