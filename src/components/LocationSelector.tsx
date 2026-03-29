import { Button, Space, Typography } from 'antd';
import { useLocationStore } from '@/store/location.store';

const DEFAULT_LOCATIONS = [
  { location_id: 'loc-1', location_code: 'ALT', location_name: 'ALT' },
  { location_id: 'loc-2', location_code: 'ALV', location_name: 'ALV' },
];

const LocationSelector = () => {
  const { currentLocationCode, locations, setCurrentLocation } = useLocationStore();

  const displayLocations = locations.length > 0 ? locations : DEFAULT_LOCATIONS;

  return (
    <div>
      <Typography.Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6, display: 'block' }}>
        공장 선택
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        {displayLocations.map((loc) => (
          <Button
            key={loc.location_id}
            type={currentLocationCode === loc.location_code ? 'primary' : 'default'}
            onClick={() => setCurrentLocation(loc.location_id, loc.location_code)}
            style={{
              flex: 1,
              fontWeight: 700,
              height: 36,
              ...(currentLocationCode !== loc.location_code
                ? { background: '#374151', color: '#fff', borderColor: '#4b5563' }
                : {}),
            }}
          >
            {loc.location_code}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default LocationSelector;
