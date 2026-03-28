import { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Card,
  Tag,
  Button,
  Space,
  Alert,
  Badge,
  Breadcrumb,
  message,
} from 'antd';
import { SearchOutlined, BellOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useInventoryStore } from '@/store/inventory.store';
import type { InventoryWithItem } from '@/services/inventory.service';

const getQuantityColor = (
  qty: number,
  reorderPoint: number,
  minStock: number
): string => {
  if (qty >= reorderPoint) return 'green';
  if (qty >= minStock) return 'orange';
  return 'red';
};

const getQuantityStatus = (
  qty: number,
  reorderPoint: number,
  minStock: number
): string => {
  if (qty >= reorderPoint) return '정상';
  if (qty >= minStock) return '주의';
  return '부족';
};

const Inventory = () => {
  const { t } = useTranslation();
  const { inventoryItems, alerts, isLoading, fetchInventory, fetchAlerts, acknowledgeAlert, resolveAlert } =
    useInventoryStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchAlerts();
  }, []);

  const filteredItems = inventoryItems.filter((item) => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    return item.item_name.toLowerCase().includes(q) || item.item_code.toLowerCase().includes(q);
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      message.success('알림이 확인 처리되었습니다.');
    } catch {
      message.error('처리에 실패했습니다.');
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'system');
      message.success('알림이 해결 처리되었습니다.');
    } catch {
      message.error('처리에 실패했습니다.');
    }
  };

  const columns: ColumnsType<InventoryWithItem> = [
    {
      title: '품목코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: 140,
      sorter: (a, b) => a.item_code.localeCompare(b.item_code),
    },
    {
      title: '품목명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 180,
      sorter: (a, b) => a.item_name.localeCompare(b.item_name),
    },
    {
      title: '단위',
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
    },
    {
      title: '현재수량',
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.current_quantity - b.current_quantity,
      render: (qty: number, record) => (
        <Tag color={getQuantityColor(qty, record.reorder_point, record.min_stock)}>
          {qty} ({getQuantityStatus(qty, record.reorder_point, record.min_stock)})
        </Tag>
      ),
    },
    {
      title: '재주문점',
      dataIndex: 'reorder_point',
      key: 'reorder_point',
      width: 90,
      align: 'right',
    },
    {
      title: '최소재고',
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 90,
      align: 'right',
    },
    {
      title: '보관위치',
      dataIndex: 'storage_location',
      key: 'storage_location',
      width: 130,
    },
    {
      title: '최종재고일',
      dataIndex: 'last_count_date',
      key: 'last_count_date',
      width: 120,
      render: (val: string) => (val ? val.slice(0, 10) : '-'),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: t('common.appName') }, { title: '재고 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>재고 관리</h2>

      {alerts.length > 0 && (
        <Card
          title={
            <Space>
              <BellOutlined style={{ color: '#faad14' }} />
              <span>재주문 알림</span>
              <Badge count={alerts.length} />
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          {alerts.map((alert) => (
            <Alert
              key={alert.alert_id}
              type="warning"
              style={{ marginBottom: 8 }}
              message={
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{alert.item_code}</strong> {alert.item_name} — 현재수량:{' '}
                    <strong>{alert.current_quantity}</strong> / 재주문점:{' '}
                    <strong>{alert.reorder_point}</strong>
                  </span>
                  <Space>
                    <Button size="small" onClick={() => handleAcknowledge(alert.alert_id)}>
                      확인
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleResolve(alert.alert_id)}
                    >
                      해결
                    </Button>
                  </Space>
                </Space>
              }
              showIcon
            />
          ))}
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="품목명 또는 코드 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
        </div>

        <Table<InventoryWithItem>
          rowKey="inventory_id"
          columns={columns}
          dataSource={filteredItems}
          loading={isLoading}
          scroll={{ x: 950 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>
    </div>
  );
};

export default Inventory;
