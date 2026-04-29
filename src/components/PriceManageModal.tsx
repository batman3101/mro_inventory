import { useEffect, useMemo, useState } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button, Table, Tag, Space, Form, InputNumber, Select, DatePicker, Popconfirm,
  message, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Item, ItemPrice, Supplier } from '@/types/database.types';
import {
  getItemPrices, createItemPrice, updateItemPrice, deleteItemPrice,
} from '@/services/itemPrice.service';

const { Option } = Select;

interface PriceFormValues {
  unit_price: number;
  currency: string;
  supplier_id: string | null;
  effective_from: Dayjs;
  is_current: boolean;
}

interface Props {
  open: boolean;
  item: Item | null;
  suppliers: Supplier[];
  locationId: string;
  onClose: () => void;
  onChange: () => void;
}

const currencySymbol = (c: string): string => {
  if (c === 'VND') return '₫';
  if (c === 'KRW') return '₩';
  if (c === 'USD') return '$';
  return c;
};

export const PriceManageModal = ({
  open, item, suppliers, locationId, onClose, onChange,
}: Props) => {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<ItemPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ItemPrice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PriceFormValues>();

  const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s.supplier_name]));

  const loadPrices = async (itemId: string) => {
    setLoading(true);
    try {
      const fetched = await getItemPrices(itemId);
      setPrices(fetched);
    } catch (e) {
      console.error('load price history failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && item) {
      loadPrices(item.item_id);
    } else {
      setPrices([]);
    }
  }, [open, item]);

  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      form.setFieldsValue({
        unit_price: editing.unit_price,
        currency: editing.currency,
        supplier_id: editing.supplier_id,
        effective_from: dayjs(editing.effective_from),
        is_current: editing.is_current,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        currency: 'VND',
        supplier_id: null,
        effective_from: dayjs(),
        is_current: true,
      });
    }
  }, [formOpen, editing, form]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: ItemPrice) => { setEditing(p); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = async () => {
    if (!item) return;
    let values: PriceFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('price form validation failed:', e);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        item_id: item.item_id,
        location_id: locationId,
        unit_price: values.unit_price,
        currency: values.currency,
        supplier_id: values.supplier_id || null,
        effective_from: values.effective_from.format('YYYY-MM-DD'),
        effective_to: null,
        is_current: values.is_current,
        created_by: '',
      };
      if (editing) {
        await updateItemPrice(editing.price_id, payload);
        message.success(t('items.priceUpdateSuccess'));
      } else {
        await createItemPrice(payload);
        message.success(t('items.priceCreateSuccess'));
      }
      closeForm();
      await loadPrices(item.item_id);
      onChange();
    } catch (e) {
      console.error('price submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (priceId: string) => {
    if (!item) return;
    try {
      await deleteItemPrice(priceId);
      message.success(t('items.priceDeleteSuccess'));
      await loadPrices(item.item_id);
      onChange();
    } catch (e) {
      console.error('price delete failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  // Compute previous-price-by-same-currency to derive change % for each row.
  // Service returns prices sorted by effective_from desc; we walk forward
  // (chronologically backwards) and remember the most recent prior price per
  // currency for comparison.
  const priceWithChange = useMemo(() => {
    const sortedAsc = [...prices].sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from)
    );
    const prevByCurrency = new Map<string, number>();
    const changeMap = new Map<string, number | null>();
    for (const p of sortedAsc) {
      const prev = prevByCurrency.get(p.currency);
      if (prev !== undefined && prev > 0) {
        changeMap.set(p.price_id, ((p.unit_price - prev) / prev) * 100);
      } else {
        changeMap.set(p.price_id, null);
      }
      prevByCurrency.set(p.currency, p.unit_price);
    }
    return changeMap;
  }, [prices]);

  const renderChange = (pct: number | null) => {
    if (pct === null) return <span style={{ color: '#ccc' }}>—</span>;
    if (Math.abs(pct) < 0.005) return <span style={{ color: '#888' }}>0.00%</span>;
    const positive = pct > 0;
    const text = `${positive ? '+' : ''}${pct.toFixed(2)}%`;
    const color = positive ? '#ef4444' : '#10b981'; // red rise / green drop (price)
    return <span style={{ color, fontWeight: 600 }}>{text}</span>;
  };

  const currencyFilters = useMemo(() => {
    const set = new Set(prices.map((p) => p.currency));
    return Array.from(set).map((c) => ({ text: c, value: c }));
  }, [prices]);

  const columns: ColumnsType<ItemPrice> = [
    {
      title: t('items.effectiveFrom'),
      dataIndex: 'effective_from',
      key: 'effective_from',
      width: 110,
      sorter: (a, b) => a.effective_from.localeCompare(b.effective_from),
      defaultSortOrder: 'descend',
    },
    {
      title: t('items.priceCurrencyCol'),
      dataIndex: 'currency',
      key: 'currency',
      width: 80,
      filters: currencyFilters,
      onFilter: (value, record) => record.currency === value,
      render: (c: string) => `${c} ${currencySymbol(c)}`,
    },
    {
      title: t('items.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 130,
      align: 'right',
      // Currency-aware sort: same currency rows sort numerically; different
      // currencies fall back to currency code so apples don't compare to oranges.
      sorter: (a, b) => {
        if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
        return a.unit_price - b.unit_price;
      },
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('items.priceChange'),
      key: 'change',
      width: 100,
      align: 'right',
      render: (_, record) => renderChange(priceWithChange.get(record.price_id) ?? null),
    },
    {
      title: t('items.priceSupplier'),
      dataIndex: 'supplier_id',
      key: 'supplier_id',
      width: 160,
      render: (id: string | null) =>
        id ? supplierMap.get(id) ?? id :
          <span style={{ color: '#aaa' }}>{t('items.priceNoSupplier')}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'is_current',
      key: 'is_current',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">{t('items.priceCurrent')}</Tag> : null,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title={t('items.deletePriceConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.price_id)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <DraggableModal
        title={item ? `${t('items.managePrice')} — ${item.item_code} ${item.item_name}` : t('items.managePrice')}
        open={open}
        onCancel={onClose}
        footer={<Button onClick={onClose}>{t('common.cancel')}</Button>}
        width={760}
        destroyOnHidden
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('items.addPrice')}
          </Button>
        </div>
        {prices.length === 0 && !loading ? (
          <Empty description={t('items.priceHistoryEmpty')} />
        ) : (
          <Table<ItemPrice>
            rowKey="price_id"
            columns={columns}
            dataSource={prices}
            loading={loading}
            pagination={false}
            size="small"
          />
        )}
      </DraggableModal>

      <DraggableModal
        title={editing ? t('items.editPrice') : t('items.addPrice')}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={closeForm}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <Form.Item
              name="unit_price"
              label={t('items.unitPrice')}
              rules={[{ required: true, message: t('items.priceRequired') }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="currency" label={t('items.currency')}>
              <Select>
                <Option value="VND">VND (₫)</Option>
                <Option value="KRW">KRW (₩)</Option>
                <Option value="USD">USD ($)</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="supplier_id" label={t('items.priceSupplier')}>
            <Select
              allowClear
              placeholder={t('items.priceNoSupplier')}
              showSearch
              optionFilterProp="children"
            >
              {suppliers.map((s) => (
                <Option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="effective_from"
            label={t('items.effectiveFrom')}
            rules={[{ required: true, message: t('items.priceEffectiveRequired') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_current" label={t('items.priceCurrent')}>
            <Select>
              <Option value={true}>{t('common.active')}</Option>
              <Option value={false}>{t('common.inactive')}</Option>
            </Select>
          </Form.Item>
        </Form>
      </DraggableModal>
    </>
  );
};
