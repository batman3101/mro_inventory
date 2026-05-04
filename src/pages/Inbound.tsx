import { useState, useEffect, useMemo } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button, Select, Form, Space, Popconfirm, message,
  Card, Col, Row, Statistic, Input, InputNumber, DatePicker,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs, { Dayjs } from 'dayjs';
import type { Inbound } from '@/types/database.types';
import { useInboundStore } from '@/store/inbound.store';
import { useItemsStore } from '@/store/items.store';
import { useSupplierStore } from '@/store/suppliers.store';
import { useLocationStore } from '@/store/location.store';

const { RangePicker } = DatePicker;
const CURRENCY_SYMBOL: Record<string, string> = { VND: '₫', KRW: '₩', USD: '$' };
const CURRENCY_OPTIONS = ['VND', 'KRW', 'USD'];

interface InboundFormValues {
  item_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  currency: string;
  notes: string;
  inbound_date: Dayjs;
}

const fmtPrice = (price: number | null | undefined, currency: string) =>
  price == null ? '-' : `${price.toLocaleString()} ${CURRENCY_SYMBOL[currency] ?? currency}`;

const InboundPage = () => {
  const { t } = useTranslation();
  const { inboundRecords, isLoading, fetchInbound, createInbound, updateInbound, deleteInbound } = useInboundStore();
  const { items, fetchItems } = useItemsStore();
  const { suppliers, fetchSuppliers } = useSupplierStore();
  const { currentLocationId } = useLocationStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Inbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [calcTotal, setCalcTotal] = useState(0);
  const [form] = Form.useForm<InboundFormValues>();

  useEffect(() => { fetchInbound(); fetchItems(); fetchSuppliers(); }, []);

  const filteredRecords = useMemo(() => {
    const [start, end] = dateRange;
    const q = searchQuery.toLowerCase();
    return inboundRecords.filter((r) => {
      if (q && !r.reference_number.toLowerCase().includes(q) &&
          !r.item_name.toLowerCase().includes(q) &&
          !r.item_code.toLowerCase().includes(q) &&
          !r.supplier_name.toLowerCase().includes(q)) return false;
      if (start && dayjs(r.inbound_date).isBefore(start, 'day')) return false;
      if (end && dayjs(r.inbound_date).isAfter(end, 'day')) return false;
      return true;
    });
  }, [inboundRecords, searchQuery, dateRange]);

  const stats = useMemo(() => ({
    totalQuantity: filteredRecords.reduce((s, r) => s + r.quantity, 0),
    totalCount: filteredRecords.length,
    totalAmount: filteredRecords.reduce((s, r) => s + (r.total_price ?? 0), 0),
  }), [filteredRecords]);

  const handleValuesChange = (_: Partial<InboundFormValues>, all: InboundFormValues) =>
    setCalcTotal((all.quantity ?? 0) * (all.unit_price ?? 0));

  useEffect(() => {
    if (!modalOpen) return;
    if (editingRecord) {
      form.setFieldsValue({
        item_id: editingRecord.item_id, supplier_id: editingRecord.supplier_id,
        quantity: editingRecord.quantity, unit_price: editingRecord.unit_price,
        currency: editingRecord.currency, notes: editingRecord.notes,
        inbound_date: dayjs(editingRecord.inbound_date),
      });
      setCalcTotal(editingRecord.total_price ?? 0);
    } else {
      form.resetFields();
      form.setFieldsValue({ currency: 'VND', inbound_date: dayjs() });
      setCalcTotal(0);
    }
  }, [modalOpen, editingRecord, form]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (record: Inbound) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false); setEditingRecord(null); setCalcTotal(0);
  };

  const handleSubmit = async () => {
    let values: InboundFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('inbound form validation failed:', e);
      return;
    }
    if (!currentLocationId) { message.error(t('inbound.locationRequired')); return; }
    setSubmitting(true);
    try {
      const payload = {
        item_id: values.item_id, supplier_id: values.supplier_id,
        quantity: values.quantity, unit_price: values.unit_price,
        currency: values.currency, notes: values.notes ?? '',
        inbound_date: values.inbound_date.format('YYYY-MM-DD'),
      };
      if (editingRecord) {
        await updateInbound(editingRecord.inbound_id, payload, 'admin');
        message.success(t('inbound.editSuccess'));
      } else {
        await createInbound({ ...payload, location_id: currentLocationId, created_by: '' });
        message.success(t('inbound.createSuccess'));
      }
      handleModalCancel();
    } catch (e) {
      console.error('inbound submit failed:', e);
      message.error(e instanceof Error ? e.message : t('inbound.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteInbound(id, 'admin'); message.success(t('inbound.deleteSuccess')); }
    catch (e) {
      console.error('inbound delete failed:', e);
      message.error(e instanceof Error ? e.message : t('inbound.deleteFailed'));
    }
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) =>
    setDateRange(dates ? [dates[0] ?? null, dates[1] ?? null] : [null, null]);

  const handleResetFilter = () => { setSearchQuery(''); setDateRange([null, null]); };

  const columns: ColumnsType<Inbound> = [
    {
      title: t('inbound.referenceNumber'), dataIndex: 'reference_number', key: 'reference_number',
      width: 160, sorter: (a, b) => a.reference_number.localeCompare(b.reference_number),
    },
    {
      title: t('inbound.inboundDate'), dataIndex: 'inbound_date', key: 'inbound_date',
      width: 110, sorter: (a, b) => a.inbound_date.localeCompare(b.inbound_date),
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: t('inbound.supplier'), dataIndex: 'supplier_name', key: 'supplier_name',
      width: 150, sorter: (a, b) => a.supplier_name.localeCompare(b.supplier_name),
      filters: Array.from(new Set(inboundRecords.map((r) => r.supplier_name))).map((n) => ({ text: n, value: n })),
      onFilter: (value, record) => record.supplier_name === value,
    },
    {
      title: t('items.itemCode'), dataIndex: 'item_code', key: 'item_code',
      width: 120, sorter: (a, b) => a.item_code.localeCompare(b.item_code),
      filters: Array.from(new Set(inboundRecords.map((r) => r.item_code))).map((c) => ({ text: c, value: c })),
      onFilter: (value, record) => record.item_code === value,
    },
    {
      title: t('items.itemName'), dataIndex: 'item_name', key: 'item_name',
      width: 160, sorter: (a, b) => a.item_name.localeCompare(b.item_name),
    },
    {
      title: t('inbound.quantity'), dataIndex: 'quantity', key: 'quantity',
      width: 90, align: 'right', sorter: (a, b) => a.quantity - b.quantity,
      render: (v: number, r) => `${v} ${r.item_unit ?? ''}`.trim(),
    },
    {
      title: t('inbound.unitPrice'), dataIndex: 'unit_price', key: 'unit_price',
      width: 130, align: 'right', sorter: (a, b) => (a.unit_price ?? 0) - (b.unit_price ?? 0),
      render: (v: number, r) => fmtPrice(v, r.currency),
    },
    {
      title: t('inbound.totalPrice'), dataIndex: 'total_price', key: 'total_price',
      width: 140, align: 'right', sorter: (a, b) => (a.total_price ?? 0) - (b.total_price ?? 0),
      render: (v: number, r) => fmtPrice(v, r.currency),
    },
    {
      title: t('common.actions'), key: 'actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)} style={{ color: '#1677ff', padding: 0 }} />
          <Popconfirm title={t('inbound.deleteConfirm')} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => handleDelete(record.inbound_id)}>
            <Button type="link" danger icon={<DeleteOutlined />} style={{ padding: 0 }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('inbound.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>{t('inbound.newInbound')}</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card><Statistic title={t('inbound.totalQuantity')} value={stats.totalQuantity} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title={t('inbound.totalCount')} value={stats.totalCount} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title={t('inbound.totalAmount')} value={stats.totalAmount.toLocaleString()} suffix="₫" valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input placeholder={t('inbound.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 260 }} allowClear />
          <RangePicker value={dateRange[0] || dateRange[1] ? [dateRange[0], dateRange[1]] : null} onChange={handleDateRangeChange} placeholder={[t('inbound.startDate'), t('inbound.endDate')]} />
          <Button icon={<ReloadOutlined />} onClick={handleResetFilter}>{t('inbound.resetFilter')}</Button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666' }}>{t('common.total', { count: filteredRecords.length })}</span>
            <Button icon={<FileExcelOutlined />}>{t('inbound.exportExcel')}</Button>
          </div>
        </div>
        <ResizableTable<Inbound>
          rowKey="inbound_id" columns={columns} dataSource={filteredRecords} loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('common.total', { count: total }) }}
        />
      </Card>

      <DraggableModal
        title={editingRecord ? t('inbound.editInbound') : t('inbound.createInbound')}
        open={modalOpen} onOk={handleSubmit} onCancel={handleModalCancel}
        okText={t('common.save')} cancelText={t('common.cancel')}
        confirmLoading={submitting} width={560} destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }} onValuesChange={handleValuesChange}>
          {!editingRecord && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{t('inbound.referenceNumber')}</div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontWeight: 600 }}>
                {t('inbound.autoGenerated')}
              </div>
            </div>
          )}
          <Form.Item name="item_id" label={t('inbound.itemLabel')} rules={[{ required: true, message: t('inbound.selectItemMessage') }]}>
            <Select showSearch placeholder={t('inbound.itemPlaceholder')} optionFilterProp="label"
              options={items.map((item) => ({ value: item.item_id, label: `${item.item_code} - ${item.item_name}` }))} />
          </Form.Item>
          <Form.Item name="supplier_id" label={t('inbound.supplier')} rules={[{ required: true, message: t('inbound.selectSupplierMessage') }]}>
            <Select showSearch placeholder={t('inbound.supplierPlaceholder')} optionFilterProp="label"
              options={suppliers.map((s) => ({ value: s.supplier_id, label: s.supplier_name }))} />
          </Form.Item>
          <Form.Item name="inbound_date" label={t('inbound.inboundDate')} rules={[{ required: true, message: t('inbound.selectDateMessage') }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity" label={t('inbound.quantity')} rules={[{ required: true, message: t('inbound.enterQuantityMessage') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit_price" label={t('inbound.unitPrice')} rules={[{ required: true, message: t('inbound.enterUnitPriceMessage') }]}>
            <InputNumber
              min={0} style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              addonAfter={CURRENCY_SYMBOL[form.getFieldValue('currency') as string] ?? '₫'}
            />
          </Form.Item>
          <Form.Item name="currency" label={t('inbound.currency')}>
            <Select>
              {CURRENCY_OPTIONS.map((c) => <Select.Option key={c} value={c}>{c} ({CURRENCY_SYMBOL[c]})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label={t('inbound.notes')}>
            <Input.TextArea rows={3} placeholder={t('inbound.notesPlaceholder')} />
          </Form.Item>
        </Form>
      </DraggableModal>
    </div>
  );
};

export default InboundPage;
