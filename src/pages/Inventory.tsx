import { useState, useEffect, useMemo } from 'react';
import {
  Input,
  Card,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  InputNumber,
  message,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import {
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import { useInventoryStore } from '@/store/inventory.store';
import type { InventoryWithItem } from '@/services/inventory.service';

const Inventory = () => {
  const { t } = useTranslation();
  const { inventoryItems, isLoading, fetchInventory } = useInventoryStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryWithItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredItems = useMemo(() => {
    if (searchQuery === '') return inventoryItems;
    const q = searchQuery.toLowerCase();
    return inventoryItems.filter(
      (item) =>
        item.item_name.toLowerCase().includes(q) ||
        item.item_code.toLowerCase().includes(q)
    );
  }, [inventoryItems, searchQuery]);

  const stats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const totalQuantity = inventoryItems.reduce((sum, i) => sum + i.current_quantity, 0);
    const lowStockCount = inventoryItems.filter((i) => i.current_quantity < i.min_stock).length;
    const locations = new Set(inventoryItems.map((i) => i.storage_location).filter(Boolean));
    return { totalItems, totalQuantity, lowStockCount, locationCount: locations.size || 1 };
  }, [inventoryItems]);

  const openEditModal = (record: InventoryWithItem) => {
    setEditingItem(record);
    form.setFieldsValue({ current_quantity: record.current_quantity });
    setEditModal(true);
  };

  const handleEditSubmit = async () => {
    const values = await form.validateFields();
    if (!editingItem) return;
    try {
      const { updateQuantity } = useInventoryStore.getState();
      await updateQuantity(editingItem.inventory_id, values.current_quantity, 'admin');
      message.success(t('inventory.updateSuccess'));
      setEditModal(false);
      setEditingItem(null);
      fetchInventory();
    } catch {
      message.error(t('inventory.processFailed'));
    }
  };

  const handleExport = () => {
    const exportData = filteredItems.map((item) => ({
      [t('items.itemCode')]: item.item_code,
      [t('items.itemName')]: item.item_name,
      [t('items.category')]: item.category_name ?? '',
      [t('inventory.currentQuantity')]: item.current_quantity,
      [t('items.minStock')]: item.min_stock,
      [t('items.unit')]: item.unit,
      [t('inventory.location')]: item.storage_location || 'main',
      [t('inventory.lastCountDate')]: item.last_count_date ? item.last_count_date.slice(0, 16).replace('T', ' ') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('inventory.title'));
    XLSX.writeFile(wb, `MRO_${t('inventory.title')}.xlsx`);
  };

  const handleBulkImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      message.info(t('inventory.importProcessing'));
      // TODO: Implement bulk import with Supabase
    };
    input.click();
  };

  const columns: ColumnsType<InventoryWithItem> = [
    {
      title: t('items.itemCode'),
      dataIndex: 'item_code',
      key: 'item_code',
      width: 120,
      sorter: (a, b) => a.item_code.localeCompare(b.item_code),
    },
    {
      title: t('items.itemName'),
      dataIndex: 'item_name',
      key: 'item_name',
      width: 240,
      sorter: (a, b) => a.item_name.localeCompare(b.item_name),
    },
    {
      title: t('items.category'),
      dataIndex: 'category_name',
      key: 'category_name',
      width: 120,
      sorter: (a, b) => (a.category_name ?? '').localeCompare(b.category_name ?? ''),
      filters: Array.from(new Set(inventoryItems.map((i) => i.category_name).filter(Boolean))).map(
        (c) => ({ text: c!, value: c! })
      ),
      onFilter: (value, record) => record.category_name === value,
    },
    {
      title: t('inventory.currentQuantity'),
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.current_quantity - b.current_quantity,
      render: (qty: number, record) => {
        if (qty === 0 || qty < record.min_stock) {
          return (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>
              {qty} <WarningOutlined style={{ fontSize: 12 }} />
            </span>
          );
        }
        return qty;
      },
    },
    {
      title: t('items.minStock'),
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.min_stock - b.min_stock,
    },
    {
      title: t('items.unit'),
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
      sorter: (a, b) => a.unit.localeCompare(b.unit),
    },
    {
      title: t('inventory.location'),
      dataIndex: 'storage_location',
      key: 'storage_location',
      width: 90,
      render: (val: string) => <Tag color="blue">{val || 'main'}</Tag>,
      sorter: (a, b) => (a.storage_location ?? '').localeCompare(b.storage_location ?? ''),
    },
    {
      title: t('inventory.lastCountDate'),
      dataIndex: 'last_count_date',
      key: 'last_count_date',
      width: 150,
      sorter: (a, b) => (a.last_count_date ?? '').localeCompare(b.last_count_date ?? ''),
      render: (val: string) => (val ? val.slice(0, 16).replace('T', ' ') : '-'),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => openEditModal(record)}
        >
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h2 style={{ marginBottom: 16 }}>{t('inventory.listTitle')}</h2>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('inventory.totalItems')} value={stats.totalItems} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('inventory.totalQuantity')}
              value={stats.totalQuantity.toLocaleString()}
              valueStyle={{ color: '#2563eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('inventory.lowStockItems')}
              value={stats.lowStockCount}
              valueStyle={{ color: stats.lowStockCount > 0 ? '#ef4444' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('inventory.storageLocations')}
              value={stats.locationCount}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('inventory.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666', fontSize: 13 }}>
              {t('common.total', { count: filteredItems.length })}
            </span>
            <Button icon={<UploadOutlined />} onClick={handleBulkImport}>
              Excel {t('inventory.bulkImport')}
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Excel {t('common.export')}
            </Button>
          </div>
        </div>

        <ResizableTable<InventoryWithItem>
          rowKey="inventory_id"
          columns={columns}
          dataSource={filteredItems}
          loading={isLoading}
          scroll={{ x: 1100 }}
          rowClassName={(record) =>
            record.current_quantity === 0 || record.current_quantity < record.min_stock
              ? 'inventory-low-stock-row'
              : ''
          }
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (total) => t('common.total', { count: total }),
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title={t('inventory.editQuantity')}
        open={editModal}
        onOk={handleEditSubmit}
        onCancel={() => { setEditModal(false); setEditingItem(null); }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        {editingItem && (
          <div style={{ marginBottom: 16 }}>
            <strong>{editingItem.item_code}</strong> — {editingItem.item_name}
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="current_quantity"
            label={t('inventory.currentQuantity')}
            rules={[{ required: true, message: t('inventory.quantityRequired') }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Row highlight style */}
      <style>{`
        .inventory-low-stock-row {
          background-color: #fff1f0 !important;
        }
        .inventory-low-stock-row:hover > td {
          background-color: #ffe4e1 !important;
        }
      `}</style>
    </div>
  );
};

export default Inventory;
