import { useState, useEffect, useMemo } from 'react';
import {
  Button, Input, Select, Modal, Form, Tag, Space,
  Popconfirm, message, Card, Row, Col, Descriptions,
  Upload, Alert, List,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import {
  PlusOutlined, SearchOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { ColumnsType } from 'antd/es/table';
import type { Item, Category } from '@/types/database.types';
import { getAllItems, createItem, updateItem, deleteItem } from '@/services/items.service';
import { createItemPrice } from '@/services/itemPrice.service';
import { getOptionalLocationId } from '@/services/locationContext';
import { supabase } from '@/lib/supabase';

const { Option } = Select;

const itemFormSchema = z.object({
  item_name: z.string().min(1),
  unit: z.string().min(1),
  korean_name: z.string().optional().default(''),
  vietnamese_name: z.string().optional().default(''),
  category_id: z.string().optional().default(''),
  spec: z.string().optional().default(''),
  min_stock: z.number().min(0).optional().default(0),
  max_stock: z.number().min(0).optional().default(0),
  reorder_point: z.number().min(0).optional().default(0),
  storage_location: z.string().optional().default(''),
  status: z.string().optional().default('ACTIVE'),
  description: z.string().optional().default(''),
  unit_price: z.number().min(0).optional(),
  currency: z.string().optional().default('KRW'),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

const StatCard = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <Card>
    <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
  </Card>
);

const statusTag = (status: string, t: (k: string) => string) => {
  if (status === 'ACTIVE') return <Tag color="blue">{t('items.statusNew')}</Tag>;
  if (status === 'DISCONTINUED') return <Tag color="red">{t('items.discontinued')}</Tag>;
  return <Tag>{t('items.statusOld')}</Tag>;
};

const Items = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ItemFormValues>();
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkPriceLoading, setBulkPriceLoading] = useState(false);
  const [bulkPriceResult, setBulkPriceResult] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, { data: cats }] = await Promise.all([
        getAllItems(),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      ]);
      setItems(fetchedItems);
      setCategories(cats ?? []);
    } catch {
      message.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredItems = useMemo(
    () => items.filter((item) =>
      searchQuery === '' ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    [items, searchQuery],
  );

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.status === 'ACTIVE').length,
    inactive: items.filter((i) => i.status !== 'ACTIVE').length,
    categories: new Set(items.map((i) => i.category_id).filter(Boolean)).size,
  }), [items]);

  const getCategoryName = (id: string) =>
    categories.find((c) => c.category_id === id)?.category_name ?? id;

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    form.setFieldsValue({
      item_name: item.item_name, korean_name: item.korean_name,
      vietnamese_name: item.vietnamese_name, category_id: item.category_id,
      spec: item.spec, unit: item.unit, min_stock: item.min_stock,
      max_stock: item.max_stock, reorder_point: item.reorder_point,
      storage_location: item.storage_location, status: item.status,
      description: item.description,
    });
    setModalOpen(true);
  };

  const handleModalCancel = () => { setModalOpen(false); setEditingItem(null); form.resetFields(); };

  const handleSubmit = async () => {
    let values: ItemFormValues;
    try { values = itemFormSchema.parse(await form.validateFields()); } catch { return; }
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.item_id, values);
        message.success(t('items.updateSuccess'));
      } else {
        const created = await createItem({
          ...values, item_code: '',
          korean_name: values.korean_name ?? '',
          vietnamese_name: values.vietnamese_name ?? '',
          category_id: values.category_id ?? '',
          spec: values.spec ?? '',
          min_stock: values.min_stock ?? 0,
          max_stock: values.max_stock ?? 0,
          reorder_point: values.reorder_point ?? 0,
          storage_location: values.storage_location ?? '',
          status: values.status ?? 'ACTIVE',
          description: values.description ?? '',
          created_by: '', updated_by: '',
        });
        if (values.unit_price && values.unit_price > 0 && created) {
          const locationId = getOptionalLocationId() || 'loc-1';
          await createItemPrice({
            item_id: created.item_id,
            location_id: locationId,
            unit_price: values.unit_price,
            currency: values.currency ?? 'KRW',
            supplier_id: null,
            effective_from: new Date().toISOString().slice(0, 10),
            effective_to: null,
            is_current: true,
            created_by: '',
          });
        }
        message.success(t('items.createSuccess'));
      }
      handleModalCancel();
      fetchData();
    } catch { message.error(t('common.error')); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteItem(itemId);
      message.success(t('items.deleteSuccess'));
      setItems((prev) => prev.filter((i) => i.item_id !== itemId));
    } catch { message.error(t('common.error')); }
  };

  const handleToggleStatus = async (item: Item) => {
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateItem(item.item_id, { status: newStatus });
      message.success(newStatus === 'INACTIVE' ? t('items.deactivateSuccess') : t('items.activateSuccess'));
      setItems((prev) => prev.map((i) => i.item_id === item.item_id ? { ...i, status: newStatus } : i));
    } catch { message.error(t('common.error')); }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredItems.map((item) => ({
      [t('items.itemCode')]: item.item_code,
      [t('items.itemName')]: item.item_name,
      [t('items.category')]: getCategoryName(item.category_id),
      [t('items.unit')]: item.unit,
      [t('items.minStock')]: item.min_stock,
      [t('common.status')]: item.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('items.title'));
    XLSX.writeFile(wb, 'MRO_items.xlsx');
  };

  const handlePriceTemplate = () => {
    const headers = [
      { [t('items.itemCode')]: '', [t('items.itemName')]: '', [t('items.unitPrice')]: '', [t('items.currency')]: 'KRW', [t('suppliers.supplierName')]: '', [t('items.effectiveFrom')]: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(headers);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('items.priceTemplate'));
    XLSX.writeFile(wb, `MRO_${t('items.priceTemplate')}.xlsx`);
  };

  const parseExcelDate = (raw: unknown): string | null => {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return null;
      return raw.toISOString().slice(0, 10);
    }
    const s = String(raw).trim();
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  };

  const handleBulkPriceUpload = async (file: File) => {
    setBulkPriceLoading(true);
    setBulkPriceResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('supplier_id, supplier_name');
      const supplierMap = new Map<string, string>();
      (suppliers ?? []).forEach((s) => {
        const supplier = s as { supplier_id: string; supplier_name: string };
        supplierMap.set(supplier.supplier_name.trim(), supplier.supplier_id);
      });
      const itemMap = new Map(items.map((i) => [i.item_code, i.item_id]));
      const locationId = getOptionalLocationId() || 'loc-1';
      const today = new Date().toISOString().slice(0, 10);

      const codeCol = t('items.itemCode');
      const priceCol = t('items.unitPrice');
      const currencyCol = t('items.currency');
      const supplierCol = t('suppliers.supplierName');
      const effCol = t('items.effectiveFrom');

      const errors: string[] = [];
      let success = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        const itemCode = String(row[codeCol] ?? '').trim();
        if (!itemCode) {
          errors.push(
            t('items.bulkPriceErrorRow', {
              row: rowNum,
              msg: t('items.bulkPriceErrorItemCodeRequired'),
            }),
          );
          continue;
        }
        const itemId = itemMap.get(itemCode);
        if (!itemId) {
          errors.push(
            t('items.bulkPriceErrorRow', {
              row: rowNum,
              msg: t('items.bulkPriceErrorItemNotFound', { code: itemCode }),
            }),
          );
          continue;
        }

        const priceNum = Number(row[priceCol]);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
          errors.push(
            t('items.bulkPriceErrorRow', {
              row: rowNum,
              msg: t('items.bulkPriceErrorInvalidPrice'),
            }),
          );
          continue;
        }

        const rawEff = row[effCol];
        let effFrom = today;
        if (rawEff !== '' && rawEff != null) {
          const parsed = parseExcelDate(rawEff);
          if (!parsed) {
            errors.push(
              t('items.bulkPriceErrorRow', {
                row: rowNum,
                msg: t('items.bulkPriceErrorInvalidDate'),
              }),
            );
            continue;
          }
          effFrom = parsed;
        }

        const currency = String(row[currencyCol] ?? 'KRW').trim() || 'KRW';
        const supplierName = String(row[supplierCol] ?? '').trim();
        let supplierId: string | null = null;
        if (supplierName) {
          const found = supplierMap.get(supplierName);
          if (!found) {
            errors.push(
              t('items.bulkPriceErrorRow', {
                row: rowNum,
                msg: t('items.bulkPriceErrorSupplierNotFound', { name: supplierName }),
              }),
            );
            continue;
          }
          supplierId = found;
        }

        try {
          await createItemPrice({
            item_id: itemId,
            location_id: locationId,
            unit_price: priceNum,
            currency,
            supplier_id: supplierId,
            effective_from: effFrom,
            effective_to: null,
            is_current: true,
            created_by: '',
          });
          success++;
        } catch (e) {
          errors.push(
            t('items.bulkPriceErrorRow', {
              row: rowNum,
              msg: e instanceof Error ? e.message : 'unknown',
            }),
          );
        }
      }

      setBulkPriceResult({
        total: rows.length,
        success,
        failed: errors.length,
        errors,
      });
      if (success > 0) fetchData();
    } catch {
      message.error(t('items.bulkPriceParseFailed'));
    } finally {
      setBulkPriceLoading(false);
    }
    return false;
  };

  const categoryFilters = useMemo(
    () => categories.map((c) => ({ text: c.category_name, value: c.category_id })),
    [categories],
  );
  const unitFilters = useMemo(() => {
    const units = Array.from(new Set(items.map((i) => i.unit).filter(Boolean)));
    return units.map((u) => ({ text: u, value: u }));
  }, [items]);

  const columns: ColumnsType<Item> = [
    { title: t('items.itemCode'), dataIndex: 'item_code', key: 'item_code', width: 140, sorter: (a, b) => a.item_code.localeCompare(b.item_code) },
    { title: t('items.itemName'), dataIndex: 'item_name', key: 'item_name', width: 180, sorter: (a, b) => a.item_name.localeCompare(b.item_name), ellipsis: true },
    { title: t('items.vietnameseName'), dataIndex: 'vietnamese_name', key: 'vietnamese_name', width: 160, ellipsis: true },
    { title: t('items.category'), dataIndex: 'category_id', key: 'category_id', width: 130, render: (id: string) => getCategoryName(id), filters: categoryFilters, onFilter: (value, record) => record.category_id === value },
    { title: t('items.unit'), dataIndex: 'unit', key: 'unit', width: 80, filters: unitFilters, onFilter: (value, record) => record.unit === value },
    { title: t('items.minStock'), dataIndex: 'min_stock', key: 'min_stock', width: 100, align: 'right', sorter: (a, b) => a.min_stock - b.min_stock },
    { title: t('items.recentPrice'), key: 'recent_price', width: 110, render: () => <span style={{ color: '#aaa', fontStyle: 'italic' }}>{t('items.noPrice')}</span> },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 90,
      filters: [{ text: t('items.statusNew'), value: 'ACTIVE' }, { text: t('items.statusOld'), value: 'INACTIVE' }, { text: t('items.discontinued'), value: 'DISCONTINUED' }],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => statusTag(status, t),
    },
    {
      title: t('common.actions'), key: 'actions', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} onClick={() => { setDetailItem(record); setDetailOpen(true); }} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          <Popconfirm
            title={record.status === 'ACTIVE' ? t('items.deactivateConfirm') : t('items.activateConfirm')}
            okText={t('common.confirm')} cancelText={t('common.cancel')}
            onConfirm={() => handleToggleStatus(record)}
          >
            <Button type="text" size="small">
              {record.status === 'ACTIVE' ? t('items.deactivate') : t('items.activate')}
            </Button>
          </Popconfirm>
          <Popconfirm title={t('items.deleteConfirm')} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => handleDelete(record.item_id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t('items.title')}</h2>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handlePriceTemplate}>{t('items.priceTemplate')}</Button>
          <Button icon={<UploadOutlined />} onClick={() => { setBulkPriceResult(null); setBulkPriceOpen(true); }}>{t('items.bulkPriceUpload')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>{t('items.addItem')}</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><StatCard label={t('items.totalItems')} value={stats.total} /></Col>
        <Col span={6}><StatCard label={t('items.activeItems')} value={stats.active} color="#52c41a" /></Col>
        <Col span={6}><StatCard label={t('items.categories')} value={stats.categories} color="#1890ff" /></Col>
        <Col span={6}><StatCard label={t('items.inactiveItems')} value={stats.inactive} color={stats.inactive === 0 ? '#52c41a' : '#ff4d4f'} /></Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('items.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 280 }} allowClear />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel {t('common.export')}</Button>
        </div>
        <ResizableTable<Item> rowKey="item_id" columns={columns} dataSource={filteredItems} loading={loading} scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('common.total', { count: total }) }} />
      </Card>

      <Modal title={editingItem ? t('items.editItem') : t('items.createItem')} open={modalOpen}
        onOk={handleSubmit} onCancel={handleModalCancel} okText={t('common.save')}
        cancelText={t('common.cancel')} confirmLoading={submitting} width={600} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="item_name" label={t('items.itemName')} rules={[{ required: true, message: t('items.itemNameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="korean_name" label={t('items.koreanName')}><Input /></Form.Item>
          <Form.Item name="vietnamese_name" label={t('items.vietnameseName')}><Input /></Form.Item>
          <Form.Item name="category_id" label={t('items.category')}>
            <Select placeholder={t('items.selectCategory')} allowClear>
              {categories.map((cat) => <Option key={cat.category_id} value={cat.category_id}>{cat.category_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="spec" label={t('items.spec')}><Input /></Form.Item>
          <Form.Item name="unit" label={t('items.unit')} rules={[{ required: true, message: t('items.unitRequired') }]}><Input /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Form.Item name="min_stock" label={t('items.minStock')}><Input type="number" min={0} /></Form.Item>
            <Form.Item name="max_stock" label={t('items.maxStock')}><Input type="number" min={0} /></Form.Item>
            <Form.Item name="reorder_point" label={t('items.reorderPoint')}><Input type="number" min={0} /></Form.Item>
          </div>
          <Form.Item name="storage_location" label={t('items.storageLocation')}><Input /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <Form.Item name="unit_price" label={t('items.unitPrice')}>
              <Input type="number" min={0} placeholder="0" />
            </Form.Item>
            <Form.Item name="currency" label={t('items.currency')}>
              <Select>
                <Option value="KRW">KRW (₩)</Option>
                <Option value="USD">USD ($)</Option>
                <Option value="VND">VND (₫)</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="status" label={t('common.status')}>
            <Select>
              <Option value="ACTIVE">{t('common.active')}</Option>
              <Option value="INACTIVE">{t('common.inactive')}</Option>
              <Option value="DISCONTINUED">{t('items.discontinued')}</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label={t('items.description')}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('items.detail')} open={detailOpen} onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('common.cancel')}</Button>}
        width={680} destroyOnClose>
        {detailItem && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label={t('items.itemCode')}>{detailItem.item_code}</Descriptions.Item>
            <Descriptions.Item label={t('items.itemName')}>{detailItem.item_name}</Descriptions.Item>
            <Descriptions.Item label={t('items.koreanName')}>{detailItem.korean_name}</Descriptions.Item>
            <Descriptions.Item label={t('items.vietnameseName')}>{detailItem.vietnamese_name}</Descriptions.Item>
            <Descriptions.Item label={t('items.category')}>{getCategoryName(detailItem.category_id)}</Descriptions.Item>
            <Descriptions.Item label={t('items.spec')}>{detailItem.spec}</Descriptions.Item>
            <Descriptions.Item label={t('items.unit')}>{detailItem.unit}</Descriptions.Item>
            <Descriptions.Item label={t('items.minStock')}>{detailItem.min_stock}</Descriptions.Item>
            <Descriptions.Item label={t('items.maxStock')}>{detailItem.max_stock}</Descriptions.Item>
            <Descriptions.Item label={t('items.reorderPoint')}>{detailItem.reorder_point}</Descriptions.Item>
            <Descriptions.Item label={t('items.storageLocation')}>{detailItem.storage_location}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>{statusTag(detailItem.status, t)}</Descriptions.Item>
            <Descriptions.Item label={t('items.description')} span={2}>{detailItem.description}</Descriptions.Item>
            <Descriptions.Item label={t('common.createdAt')}>{detailItem.created_at}</Descriptions.Item>
            <Descriptions.Item label={t('common.updatedAt')}>{detailItem.updated_at}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={t('items.bulkPriceDialogTitle')}
        open={bulkPriceOpen}
        onCancel={() => setBulkPriceOpen(false)}
        footer={<Button onClick={() => setBulkPriceOpen(false)}>{t('common.cancel')}</Button>}
        width={680}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert type="info" showIcon message={t('items.bulkPriceHelp')} />

          <Upload.Dragger
            multiple={false}
            accept=".xlsx,.xls"
            showUploadList={false}
            disabled={bulkPriceLoading}
            beforeUpload={(file) => {
              handleBulkPriceUpload(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{t('items.bulkPriceDropHint')}</p>
          </Upload.Dragger>

          {bulkPriceLoading && <Alert type="warning" message={t('items.bulkPriceProcessing')} />}

          {bulkPriceResult && (
            <>
              <Alert
                type={bulkPriceResult.failed === 0 ? 'success' : 'warning'}
                showIcon
                message={t('items.bulkPriceResultTitle')}
                description={t('items.bulkPriceSummary', {
                  total: bulkPriceResult.total,
                  success: bulkPriceResult.success,
                  failed: bulkPriceResult.failed,
                })}
              />
              {bulkPriceResult.errors.length > 0 && (
                <List
                  size="small"
                  bordered
                  dataSource={bulkPriceResult.errors}
                  style={{ maxHeight: 240, overflowY: 'auto' }}
                  renderItem={(item) => (
                    <List.Item style={{ color: '#ff4d4f' }}>{item}</List.Item>
                  )}
                />
              )}
            </>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default Items;
