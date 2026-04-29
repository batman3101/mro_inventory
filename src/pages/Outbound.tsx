import { useState, useEffect, useMemo } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button, Input, Select, Form, Space, Popconfirm,
  message, Card, Row, Col, Statistic, InputNumber, DatePicker, Alert,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import { PlusOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { Outbound, Item, Department } from '@/types/database.types';
import { getAllItems } from '@/services/items.service';
import { getAllDepartments } from '@/services/departments.service';
import { checkStock } from '@/services/outbound.service';
import { useOutboundStore } from '@/store/outbound.store';
import { supabase } from '@/lib/supabase';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface OutboundFormValues {
  item_id: string;
  quantity: number;
  requester: string;
  department_id: string | null;
  purpose: string;
  cost_center: string;
  outbound_date: Dayjs;
  notes: string;
}

const OutboundPage = () => {
  const { t } = useTranslation();
  const { outboundRecords, isLoading, fetchOutbound, createOutbound, deleteOutbound } =
    useOutboundStore();

  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<{ location_id: string; location_name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Outbound | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [form] = Form.useForm<OutboundFormValues>();
  const watchedItemId = Form.useWatch('item_id', form);
  const watchedQty = Form.useWatch('quantity', form);

  useEffect(() => {
    fetchOutbound();
    Promise.all([
      getAllItems(),
      getAllDepartments(),
      supabase.from('locations').select('location_id, location_name').eq('is_active', true),
    ])
      .then(([fetchedItems, fetchedDepts, { data: locs }]) => {
        setItems(fetchedItems);
        setDepartments(fetchedDepts);
        setLocations(locs ?? []);
      })
      .catch(() => message.error(t('common.error')));
  }, []);

  useEffect(() => {
    if (!watchedItemId || !selectedLocationId) { setCurrentStock(null); return; }
    checkStock(watchedItemId, selectedLocationId)
      .then(setCurrentStock)
      .catch(() => setCurrentStock(null));
  }, [watchedItemId, selectedLocationId]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return outboundRecords.filter((r) => {
      const matchSearch = q === '' ||
        r.item_name.toLowerCase().includes(q) ||
        r.item_code.toLowerCase().includes(q) ||
        r.reference_number.toLowerCase().includes(q) ||
        r.requester.toLowerCase().includes(q);
      const matchDate = !dateRange || !dateRange[0] || !dateRange[1] ||
        (r.outbound_date >= dateRange[0].format('YYYY-MM-DD') &&
          r.outbound_date <= dateRange[1].format('YYYY-MM-DD'));
      return matchSearch && matchDate;
    });
  }, [outboundRecords, searchQuery, dateRange]);

  const stats = useMemo(() => ({
    totalQuantity: outboundRecords.reduce((s, r) => s + r.quantity, 0),
    totalCount: outboundRecords.length,
    monthlyCount: outboundRecords.filter((r) =>
      r.outbound_date.startsWith(dayjs().format('YYYY-MM'))
    ).length,
  }), [outboundRecords]);

  useEffect(() => {
    if (!modalOpen) return;
    if (editingRecord) {
      setSelectedLocationId(editingRecord.location_id);
      form.setFieldsValue({
        item_id: editingRecord.item_id,
        quantity: editingRecord.quantity,
        requester: editingRecord.requester,
        department_id: editingRecord.department_id,
        purpose: editingRecord.purpose,
        cost_center: editingRecord.cost_center,
        outbound_date: dayjs(editingRecord.outbound_date),
        notes: editingRecord.notes,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ outbound_date: dayjs() });
      setSelectedLocationId('');
    }
    setCurrentStock(null);
  }, [modalOpen, editingRecord, form]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (record: Outbound) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setCurrentStock(null);
    setSelectedLocationId('');
  };

  const handleSubmit = async () => {
    let values: OutboundFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('outbound form validation failed:', e);
      return;
    }
    if (!selectedLocationId) { message.warning(t('outbound.locationSelect')); return; }

    setSubmitting(true);
    try {
      if (editingRecord) {
        const { error } = await supabase.from('outbound').update({
          item_id: values.item_id, location_id: selectedLocationId,
          quantity: values.quantity, requester: values.requester,
          department_id: values.department_id ?? null,
          purpose: values.purpose ?? '', cost_center: values.cost_center ?? '',
          outbound_date: values.outbound_date.format('YYYY-MM-DD'),
          notes: values.notes ?? '',
        }).eq('outbound_id', editingRecord.outbound_id);
        if (error) throw new Error(error.message);
        message.success(t('outbound.editSuccess'));
        await fetchOutbound();
      } else {
        await createOutbound({
          item_id: values.item_id, location_id: selectedLocationId,
          quantity: values.quantity, requester: values.requester,
          department_id: values.department_id ?? null,
          purpose: values.purpose ?? '', cost_center: values.cost_center ?? '',
          outbound_date: values.outbound_date.format('YYYY-MM-DD'),
          reference_number: '', notes: values.notes ?? '', created_by: '',
        });
        message.success(t('outbound.createSuccess'));
      }
      handleModalCancel();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOutbound(id);
      message.success(t('outbound.deleteSuccess'));
    } catch (e) {
      console.error('outbound delete failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleExcelExport = () => {
    const header = [t('outbound.referenceNumber'), t('outbound.outboundDate'),
      t('items.itemCode'), t('items.itemName'), t('outbound.quantity'),
      t('outbound.requester'), t('outbound.department'), t('outbound.purpose')].join(',');
    const rows = filteredRecords.map((r) =>
      [r.reference_number, r.outbound_date, r.item_code, r.item_name,
        `${r.quantity} ${r.item_unit}`, r.requester, r.department_name, r.purpose]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `outbound_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
  };

  const deptFilters = useMemo(() =>
    [...new Set(outboundRecords.map((r) => r.department_name).filter(Boolean))]
      .map((d) => ({ text: d, value: d })),
    [outboundRecords]
  );

  const columns: ColumnsType<Outbound> = [
    { title: t('outbound.referenceNumber'), dataIndex: 'reference_number', key: 'reference_number', width: 160, sorter: (a, b) => a.reference_number.localeCompare(b.reference_number) },
    { title: t('outbound.outboundDate'), dataIndex: 'outbound_date', key: 'outbound_date', width: 110, sorter: (a, b) => a.outbound_date.localeCompare(b.outbound_date) },
    { title: t('items.itemCode'), dataIndex: 'item_code', key: 'item_code', width: 120, sorter: (a, b) => a.item_code.localeCompare(b.item_code) },
    { title: t('items.itemName'), dataIndex: 'item_name', key: 'item_name', width: 160, sorter: (a, b) => a.item_name.localeCompare(b.item_name) },
    { title: t('outbound.quantity'), dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right', sorter: (a, b) => a.quantity - b.quantity, render: (qty: number, r) => `${qty} ${r.item_unit}` },
    { title: t('outbound.requester'), dataIndex: 'requester', key: 'requester', width: 110, sorter: (a, b) => a.requester.localeCompare(b.requester) },
    { title: t('outbound.department'), dataIndex: 'department_name', key: 'department_name', width: 130, filters: deptFilters, onFilter: (v, r) => r.department_name === v },
    { title: t('outbound.purpose'), dataIndex: 'purpose', key: 'purpose', width: 150, ellipsis: true },
    {
      title: t('common.actions'), key: 'actions', width: 110, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" style={{ padding: 0 }} onClick={() => openEditModal(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm title={t('outbound.deleteConfirm')} okText={t('common.confirm')} cancelText={t('common.cancel')} onConfirm={() => handleDelete(record.outbound_id)}>
            <Button type="link" danger style={{ padding: 0 }}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stockInsufficient = currentStock !== null && watchedQty !== undefined && watchedQty > currentStock;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t('outbound.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          {t('outbound.newOutbound')}
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card><Statistic title={t('outbound.totalQuantity')} value={stats.totalQuantity} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title={t('outbound.totalCount')} value={stats.totalCount} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title={t('outbound.monthlyCount')} value={stats.monthlyCount} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input prefix={<SearchOutlined />} placeholder={t('outbound.searchPlaceholder')}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 260 }} allowClear />
          <RangePicker value={dateRange} onChange={(r) => setDateRange(r as [Dayjs | null, Dayjs | null] | null)} style={{ width: 240 }} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearchQuery(''); setDateRange(null); }}>
            {t('outbound.resetFilter')}
          </Button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#666' }}>{t('common.total', { count: filteredRecords.length })}</span>
            <Button icon={<DownloadOutlined />} onClick={handleExcelExport}>
              Excel {t('common.export')}
            </Button>
          </div>
        </div>

        <ResizableTable<Outbound> rowKey="outbound_id" columns={columns} dataSource={filteredRecords}
          loading={isLoading} scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (n) => t('common.total', { count: n }) }} />
      </Card>

      <DraggableModal title={editingRecord ? t('common.edit') : t('outbound.newOutbound')}
        open={modalOpen} onOk={handleSubmit} onCancel={handleModalCancel}
        okText={t('common.save')} cancelText={t('common.cancel')}
        confirmLoading={submitting} width={600} destroyOnHidden>
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
          <Form.Item name="item_id" label={t('outbound.itemSelect')} rules={[{ required: true, message: t('items.itemNameRequired') }]}>
            <Select showSearch placeholder={t('outbound.itemSelect')} optionFilterProp="label"
              options={items.map((item) => ({ value: item.item_id, label: `${item.item_code} - ${item.item_name}` }))} />
          </Form.Item>

          <Form.Item label={t('outbound.locationSelect')} required>
            <Select placeholder={t('outbound.locationSelect')} value={selectedLocationId || undefined} onChange={setSelectedLocationId}>
              {locations.map((loc) => (
                <Option key={loc.location_id} value={loc.location_id}>{loc.location_name}</Option>
              ))}
            </Select>
          </Form.Item>

          {currentStock !== null && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: currentStock > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
                {t('outbound.currentStock')}: {currentStock}
              </span>
            </div>
          )}

          <Form.Item name="quantity" label={t('outbound.quantity')} rules={[{ required: true, message: t('outbound.quantityRequired') }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          {stockInsufficient && <Alert type="warning" message={t('outbound.stockWarning')} style={{ marginBottom: 16 }} showIcon />}

          <Form.Item name="requester" label={t('outbound.requester')} rules={[{ required: true, message: t('outbound.requesterRequired') }]}>
            <Input />
          </Form.Item>

          <Form.Item name="department_id" label={t('outbound.department')}>
            <Select placeholder={t('departments.selectDepartment')} allowClear>
              {departments.map((d) => <Option key={d.department_id} value={d.department_id}>{d.department_name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item name="purpose" label={t('outbound.purpose')}><Input /></Form.Item>
          <Form.Item name="cost_center" label={t('outbound.costCenter')}><Input /></Form.Item>

          <Form.Item name="outbound_date" label={t('outbound.outboundDate')} rules={[{ required: true, message: t('outbound.outboundDateRequired') }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label={t('inbound.notes')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </DraggableModal>
    </div>
  );
};

export default OutboundPage;
