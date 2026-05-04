import { useState, useEffect, useMemo } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button, Input, Select, Form, Tag, Space,
  Popconfirm, message, Card, Row, Col, Descriptions,
  Upload, Alert, List,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import {
  PlusOutlined, SearchOutlined, DownloadOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { ColumnsType } from 'antd/es/table';
import type { Item, Category, ItemPrice, Supplier } from '@/types/database.types';
import { getAllItems, createItem, updateItem, deleteItem } from '@/services/items.service';
import { createItemPrice, upsertItemPrice } from '@/services/itemPrice.service';
import { getOptionalLocationId } from '@/services/locationContext';
import { supabase } from '@/lib/supabase';
import {
  downloadItemImportTemplate,
  parseItemRow,
} from '@/utils/excelTemplates';
import { PriceManageModal } from '@/components/PriceManageModal';

const { Option } = Select;

// HTML <input type="number"> always returns strings via antd Form. Use z.coerce
// so "100" → 100 automatically. Blank fields fall back via .default() / undefined.
const numberFromString = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0),
);

const itemFormSchema = z.object({
  item_code: z.string().min(1),
  item_name: z.string().min(1),
  unit: z.string().min(1),
  korean_name: z.string().optional().default(''),
  vietnamese_name: z.string().optional().default(''),
  category_id: z.string().optional().default(''),
  spec: z.string().optional().default(''),
  min_stock: numberFromString.optional().default(0),
  max_stock: numberFromString.optional().default(0),
  reorder_point: numberFromString.optional().default(0),
  storage_location: z.string().optional().default(''),
  status: z.string().optional().default('ACTIVE'),
  description: z.string().optional().default(''),
  unit_price: numberFromString.optional(),
  currency: z.string().optional().default('VND'),
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
  const { t, i18n } = useTranslation();
  const isVi = i18n.language?.startsWith('vi');
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentPriceMap, setCurrentPriceMap] = useState<Map<string, ItemPrice>>(new Map());
  const [priceManageOpen, setPriceManageOpen] = useState(false);
  const [priceManageItem, setPriceManageItem] = useState<Item | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const locationId = getOptionalLocationId();
      let priceQuery = supabase.from('item_prices').select('*').eq('is_current', true);
      if (locationId) priceQuery = priceQuery.eq('location_id', locationId);
      const [fetchedItems, catsRes, pricesRes, supsRes] = await Promise.all([
        getAllItems(),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        priceQuery,
        supabase.from('suppliers').select('*'),
      ]);
      setItems(fetchedItems);
      setCategories(catsRes.data ?? []);
      setSuppliers((supsRes.data ?? []) as Supplier[]);
      const pmap = new Map<string, ItemPrice>();
      ((pricesRes.data ?? []) as ItemPrice[]).forEach((p) => pmap.set(p.item_id, p));
      setCurrentPriceMap(pmap);
    } catch (e) {
      console.error('items fetchData failed:', e);
      message.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const refreshPriceMap = async () => {
    const locationId = getOptionalLocationId();
    let q = supabase.from('item_prices').select('*').eq('is_current', true);
    if (locationId) q = q.eq('location_id', locationId);
    const { data } = await q;
    const pmap = new Map<string, ItemPrice>();
    ((data ?? []) as ItemPrice[]).forEach((p) => pmap.set(p.item_id, p));
    setCurrentPriceMap(pmap);
  };

  useEffect(() => { fetchData(); }, []);

  // Initialize / hydrate form fields whenever modal opens.
  // Avoids the "useForm not connected to any Form element" warning that
  // previously caused validateFields() to throw silently.
  useEffect(() => {
    if (!modalOpen) return;
    if (editingItem) {
      form.setFieldsValue({
        item_code: editingItem.item_code,
        item_name: editingItem.item_name,
        korean_name: editingItem.korean_name,
        vietnamese_name: editingItem.vietnamese_name,
        category_id: editingItem.category_id,
        spec: editingItem.spec,
        unit: editingItem.unit,
        min_stock: editingItem.min_stock,
        max_stock: editingItem.max_stock,
        reorder_point: editingItem.reorder_point,
        storage_location: editingItem.storage_location,
        status: editingItem.status,
        description: editingItem.description,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'ACTIVE', currency: 'VND' });
    }
  }, [modalOpen, editingItem, form]);

  const filteredItems = useMemo(
    () => items.filter((item) => {
      if (searchQuery === '') return true;
      const q = searchQuery.toLowerCase();
      return (
        item.item_name.toLowerCase().includes(q) ||
        item.item_code.toLowerCase().includes(q)
      );
    }),
    [items, searchQuery],
  );

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.status === 'ACTIVE').length,
    inactive: items.filter((i) => i.status !== 'ACTIVE').length,
    categories: new Set(items.map((i) => i.category_id).filter(Boolean)).size,
  }), [items]);

  const getCategoryName = (id: string) => {
    const c = categories.find((x) => x.category_id === id);
    if (!c) return id;
    return isVi && c.category_name_vi ? c.category_name_vi : c.category_name;
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleModalCancel = () => { setModalOpen(false); setEditingItem(null); };

  const handleSubmit = async () => {
    let values: ItemFormValues;
    try {
      values = itemFormSchema.parse(await form.validateFields());
    } catch (e) {
      console.error('item form validation failed:', e);
      return;
    }
    setSubmitting(true);
    try {
      // unit_price / currency belong on item_prices, not items.
      const { unit_price, currency, ...itemFields } = values;
      if (editingItem) {
        await updateItem(editingItem.item_id, itemFields);
        message.success(t('items.updateSuccess'));
      } else {
        const created = await createItem({
          ...itemFields,
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
          created_by: '',
          updated_by: '',
        });
        if (unit_price && unit_price > 0 && created) {
          const locationId = getOptionalLocationId();
          if (!locationId) throw new Error(t('errors.location.notSelected'));
          await createItemPrice({
            item_id: created.item_id,
            location_id: locationId,
            unit_price,
            currency: currency ?? 'VND',
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
    } catch (e) {
      console.error('item submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
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

  const handleBulkUpload = async (file: File) => {
    setBulkLoading(true);
    setBulkResult(null);
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

      // Map by name (ko + vi) first, fallback to code for power users.
      const categoryByName = new Map<string, string>();
      const categoryByCode = new Map<string, string>();
      categories.forEach((c) => {
        if (c.category_name) categoryByName.set(c.category_name.trim().toLowerCase(), c.category_id);
        if (c.category_name_vi) categoryByName.set(c.category_name_vi.trim().toLowerCase(), c.category_id);
        if (c.category_code) categoryByCode.set(c.category_code.trim().toLowerCase(), c.category_id);
      });

      const itemMap = new Map(items.map((i) => [i.item_code, i.item_id]));
      const locationId = getOptionalLocationId();
      if (!locationId) throw new Error(t('errors.location.notSelected'));
      const today = new Date().toISOString().slice(0, 10);

      const errors: string[] = [];
      const warnings: string[] = [];
      let success = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const parsed = parseItemRow(rows[i]);
        if (!parsed.ok) {
          errors.push(t('items.bulkErrorRow', { row: rowNum, msg: parsed.error }));
          continue;
        }
        const r = parsed.data;

        // Resolve category if provided — name preferred, code as fallback.
        let categoryId = '';
        if (r.categoryName) {
          const lookup = r.categoryName.trim().toLowerCase();
          const found = categoryByName.get(lookup) ?? categoryByCode.get(lookup);
          if (!found) {
            errors.push(t('items.bulkErrorRow', {
              row: rowNum,
              msg: t('items.bulkErrorCategoryNotFound', { name: r.categoryName }),
            }));
            continue;
          }
          categoryId = found;
        }

        // Resolve supplier if provided. Soft fallback: missing supplier name
        // does NOT abort the row — the price gets stored with supplier_id=null
        // and a warning is collected. User can match it later.
        let supplierId: string | null = null;
        if (r.supplierName) {
          const found = supplierMap.get(r.supplierName);
          if (found) {
            supplierId = found;
          } else {
            warnings.push(t('items.bulkErrorRow', {
              row: rowNum,
              msg: t('items.bulkWarnSupplierNotFound', { name: r.supplierName }),
            }));
          }
        }

        try {
          let itemId: string;
          if (r.itemCode) {
            // Update mode: existing item
            const existing = itemMap.get(r.itemCode);
            if (!existing) {
              errors.push(t('items.bulkErrorRow', {
                row: rowNum,
                msg: t('items.bulkErrorItemNotFound', { code: r.itemCode }),
              }));
              continue;
            }
            itemId = existing;
          } else {
            // Create new item — categoryId is required (DB FK NOT NULL).
            if (!categoryId) {
              errors.push(t('items.bulkErrorRow', {
                row: rowNum,
                msg: t('items.bulkErrorCategoryRequired'),
              }));
              continue;
            }
            // Use user-supplied item_code.
            const created = await createItem({
              item_code: r.itemCode,
              item_name: r.itemName,
              korean_name: r.koreanName,
              vietnamese_name: r.vietnameseName,
              category_id: categoryId,
              spec: r.spec,
              unit: r.unit,
              min_stock: r.minStock,
              max_stock: r.maxStock,
              reorder_point: r.reorderPoint,
              storage_location: r.storageLocation,
              status: 'ACTIVE',
              description: r.description,
              created_by: '',
              updated_by: '',
            });
            itemId = created.item_id;
            itemMap.set(created.item_code, created.item_id);
          }

          // If unit price provided, upsert item_price record. Bulk re-uploads
          // and excel rows that share (item, supplier, date) would otherwise
          // fail the unique constraint — upsert overwrites the existing price.
          if (r.unitPrice !== null && r.unitPrice > 0) {
            await upsertItemPrice({
              item_id: itemId,
              location_id: locationId,
              unit_price: r.unitPrice,
              currency: r.currency,
              supplier_id: supplierId,
              effective_from: r.effectiveFrom ?? today,
              effective_to: null,
              is_current: true,
              created_by: '',
            });
          }
          success++;
        } catch (e) {
          errors.push(t('items.bulkErrorRow', {
            row: rowNum,
            msg: e instanceof Error ? e.message : 'unknown',
          }));
        }
      }

      setBulkResult({
        total: rows.length,
        success,
        failed: errors.length,
        errors,
        warnings,
      });
      if (success > 0) fetchData();
    } catch (e) {
      console.error('bulk upload parse failed:', e);
      message.error(t('items.bulkParseFailed'));
    } finally {
      setBulkLoading(false);
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
    { title: t('items.itemCode'), dataIndex: 'item_code', key: 'item_code', width: 160, sorter: (a, b) => a.item_code.localeCompare(b.item_code) },
    { title: t('items.itemName'), dataIndex: 'item_name', key: 'item_name', width: 200, sorter: (a, b) => a.item_name.localeCompare(b.item_name), ellipsis: true },
    { title: t('items.vietnameseName'), dataIndex: 'vietnamese_name', key: 'vietnamese_name', width: 160, ellipsis: true },
    { title: t('items.category'), dataIndex: 'category_id', key: 'category_id', width: 130, render: (id: string) => getCategoryName(id), filters: categoryFilters, onFilter: (value, record) => record.category_id === value },
    { title: t('items.unit'), dataIndex: 'unit', key: 'unit', width: 80, filters: unitFilters, onFilter: (value, record) => record.unit === value },
    { title: t('items.minStock'), dataIndex: 'min_stock', key: 'min_stock', width: 100, align: 'right', sorter: (a, b) => a.min_stock - b.min_stock },
    {
      title: t('items.recentPrice'),
      key: 'recent_price',
      width: 140,
      align: 'right',
      // Currency-aware sort: prices in different currencies are not directly
      // comparable, so group by currency first and then by amount.
      sorter: (a, b) => {
        const pa = currentPriceMap.get(a.item_id);
        const pb = currentPriceMap.get(b.item_id);
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        if (pa.currency !== pb.currency) return pa.currency.localeCompare(pb.currency);
        return pa.unit_price - pb.unit_price;
      },
      render: (_, record) => {
        const p = currentPriceMap.get(record.item_id);
        if (!p) return <span style={{ color: '#aaa', fontStyle: 'italic' }}>{t('items.noPrice')}</span>;
        const symbol = p.currency === 'VND' ? '₫' : p.currency === 'KRW' ? '₩' : p.currency === 'USD' ? '$' : p.currency;
        return `${p.unit_price.toLocaleString()} ${symbol}`;
      },
    },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 90,
      filters: [{ text: t('items.statusNew'), value: 'ACTIVE' }, { text: t('items.statusOld'), value: 'INACTIVE' }, { text: t('items.discontinued'), value: 'DISCONTINUED' }],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => statusTag(status, t),
    },
    {
      title: t('common.actions'), key: 'actions', width: 240, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} onClick={() => { setDetailItem(record); setDetailOpen(true); }} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          <Button
            type="text"
            icon={<DollarOutlined />}
            title={t('items.managePrice')}
            onClick={() => { setPriceManageItem(record); setPriceManageOpen(true); }}
          />
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
          <Button icon={<DownloadOutlined />} onClick={downloadItemImportTemplate}>{t('items.itemTemplate')}</Button>
          <Button icon={<UploadOutlined />} onClick={() => { setBulkResult(null); setBulkOpen(true); }}>{t('items.bulkUpload')}</Button>
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

      <DraggableModal title={editingItem ? t('items.editItem') : t('items.createItem')} open={modalOpen}
        onOk={handleSubmit} onCancel={handleModalCancel} okText={t('common.save')}
        cancelText={t('common.cancel')} confirmLoading={submitting} width={600} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 8 }} preserve={false}>
          <Form.Item
            name="item_code"
            label={t('items.itemCode')}
            rules={[{ required: true, message: t('items.itemCodeRequired') }]}
            extra={editingItem ? undefined : 'UNIQUE'}
          >
            <Input disabled={!!editingItem} placeholder="AT-0001" />
          </Form.Item>
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
                <Option value="VND">VND (₫)</Option>
                <Option value="KRW">KRW (₩)</Option>
                <Option value="USD">USD ($)</Option>
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
      </DraggableModal>

      <DraggableModal title={t('items.detail')} open={detailOpen} onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>{t('common.cancel')}</Button>}
        width={680} destroyOnHidden>
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
      </DraggableModal>

      <DraggableModal
        title={t('items.bulkDialogTitle')}
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        footer={<Button onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>}
        width={680}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert type="info" showIcon message={t('items.bulkHelp')} />

          <Upload.Dragger
            multiple={false}
            accept=".xlsx,.xls"
            showUploadList={false}
            disabled={bulkLoading}
            beforeUpload={(file) => {
              handleBulkUpload(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{t('items.bulkDropHint')}</p>
          </Upload.Dragger>

          {bulkLoading && <Alert type="warning" message={t('items.bulkProcessing')} />}

          {bulkResult && (
            <>
              <Alert
                type={bulkResult.failed === 0 ? 'success' : 'warning'}
                showIcon
                message={t('items.bulkResultTitle')}
                description={t('items.bulkSummary', {
                  total: bulkResult.total,
                  success: bulkResult.success,
                  failed: bulkResult.failed,
                })}
              />
              {bulkResult.errors.length > 0 && (
                <List
                  size="small"
                  bordered
                  header={<strong style={{ color: '#ff4d4f' }}>{t('items.bulkErrorsHeader')}</strong>}
                  dataSource={bulkResult.errors}
                  style={{ maxHeight: 200, overflowY: 'auto' }}
                  renderItem={(item) => (
                    <List.Item style={{ color: '#ff4d4f' }}>{item}</List.Item>
                  )}
                />
              )}
              {bulkResult.warnings.length > 0 && (
                <List
                  size="small"
                  bordered
                  header={<strong style={{ color: '#faad14' }}>{t('items.bulkWarningsHeader')}</strong>}
                  dataSource={bulkResult.warnings}
                  style={{ maxHeight: 200, overflowY: 'auto' }}
                  renderItem={(item) => (
                    <List.Item style={{ color: '#faad14' }}>{item}</List.Item>
                  )}
                />
              )}
            </>
          )}
        </Space>
      </DraggableModal>

      <PriceManageModal
        open={priceManageOpen}
        item={priceManageItem}
        suppliers={suppliers}
        locationId={getOptionalLocationId() ?? ''}
        onClose={() => { setPriceManageOpen(false); setPriceManageItem(null); }}
        onChange={refreshPriceMap}
      />
    </div>
  );
};

export default Items;
