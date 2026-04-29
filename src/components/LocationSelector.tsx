import { Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocationStore } from '@/store/location.store';

const LocationSelector = () => {
  const { t } = useTranslation();
  const { currentLocationCode, locations, setCurrentLocation } = useLocationStore();

  if (locations.length === 0) {
    return (
      <Typography.Text style={{ color: '#9ca3af', fontSize: 12 }}>
        {t('common.loading')}
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Typography.Text style={{ color: '#9ca3af', fontSize: 12 }}>
        {t('components.factorySelect')}
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        {locations.map((loc) => (
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
    </Space>
  );
};

export default LocationSelector;
