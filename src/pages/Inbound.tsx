import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Select,
  Modal,
  Form,
  Space,
  Popconfirm,
  message,
  Card,
  Breadcrumb,
  InputNumber,
  DatePicker,
  Input,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs, { Dayjs } from 'dayjs';
import type { Inbound } from '@/types/database.types';
import { useInboundStore } from '@/store/inbound.store';
import { useItemsStore } from '@/store/items.store';
import { useSupplierStore } from '@/store/suppliers.store';
import { useLocationStore } from '@/store/location.store';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface InboundFormValues {
  item_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  currency: string;
  notes: string;
  inbound_date: Dayjs;
}

const CURRENCY_OPTIONS = ['KRW', 'USD', 'VND'];

const InboundPage = () => {
  const { inboundRecords, isLoading, fetchInbound, createInbound, deleteInbound } =
    useInboundStore();
  const { items, fetchItems } = useItemsStore();
  const { suppliers, fetchSuppliers } = useSupplierStore();
  const { currentLocationId } = useLocationStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [calcTotal, setCalcTotal] = useState<number>(0);
  const [form] = Form.useForm<InboundFormValues>();

  useEffect(() => {
    fetchInbound();
    fetchItems();
    fetchSuppliers();
  }, []);

  const filteredRecords = useMemo(() => {
    const [start, end] = dateRange;
    if (!start && !end) return inboundRecords;
    return inboundRecords.filter((r) => {
      const d = dayjs(r.inbound_date);
      if (start && d.isBefore(start, 'day')) return false;
      if (end && d.isAfter(end, 'day')) return false;
      return true;
    });
  }, [inboundRecords, dateRange]);

  const handleValuesChange = (_: Partial<InboundFormValues>, all: InboundFormValues) => {
    const qty = all.quantity ?? 0;
    const price = all.unit_price ?? 0;
    setCalcTotal(qty * price);
  };

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({ currency: 'KRW', inbound_date: dayjs() });
    setCalcTotal(0);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    form.resetFields();
    setCalcTotal(0);
  };

  const handleSubmit = async () => {
    let values: InboundFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (!currentLocationId) {
      message.error('위치(Location)가 선택되지 않았습니다.');
      return;
    }

    setSubmitting(true);
    try {
      await createInbound({
        item_id: values.item_id,
        supplier_id: values.supplier_id,
        location_id: currentLocationId,
        quantity: values.quantity,
        unit_price: values.unit_price,
        currency: values.currency,
        notes: values.notes ?? '',
        inbound_date: values.inbound_date.format('YYYY-MM-DD'),
        created_by: '',
      });
      message.success('입고가 등록되었습니다.');
      handleModalCancel();
    } catch {
      message.error('입고 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInbound(id);
      message.success('입고 기록이 삭제되었습니다.');
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
    if (!dates) {
      setDateRange([null, null]);
    } else {
      setDateRange([dates[0] ?? null, dates[1] ?? null]);
    }
  };

  const columns: ColumnsType<Inbound> = [
    {
      title: '입고번호',
      dataIndex: 'reference_number',
      key: 'reference_number',
      width: 160,
      sorter: (a, b) => a.reference_number.localeCompare(b.reference_number),
    },
    {
      title: '입고일',
      dataIndex: 'inbound_date',
      key: 'inbound_date',
      width: 110,
      sorter: (a, b) => a.inbound_date.localeCompare(b.inbound_date),
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '품목코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: 120,
    },
    {
      title: '품목명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 160,
    },
    {
      title: '공급업체',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 150,
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (v: number, record) => `${v} ${record.item_unit ?? ''}`,
    },
    {
      title: '단가',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 110,
      align: 'right',
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '합계금액',
      dataIndex: 'total_price',
      key: 'total_price',
      width: 120,
      align: 'right',
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '통화',
      dataIndex: 'currency',
      key: 'currency',
      width: 70,
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      width: 160,
      ellipsis: true,
    },
    {
      title: '등록자',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '작업',
      key: 'actions',
      width: 70,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            title="이 입고 기록을 삭제하시겠습니까?"
            okText="확인"
            cancelText="취소"
            onConfirm={() => handleDelete(record.inbound_id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: 'MRO 재고관리' }, { title: '입고 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>입고 관리</h2>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <RangePicker onChange={handleDateRangeChange} />
          <div style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              입고 등록
            </Button>
          </div>
        </div>

        <Table<Inbound>
          rowKey="inbound_id"
          columns={columns}
          dataSource={filteredRecords}
          loading={isLoading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>

      <Modal
        title="입고 등록"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText="저장"
        cancelText="취소"
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 8 }}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="inbound_date"
            label="입고일"
            rules={[{ required: true, message: '입고일을 선택하세요' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="item_id"
            label="품목"
            rules={[{ required: true, message: '품목을 선택하세요' }]}
          >
            <Select
              showSearch
              placeholder="품목 선택"
              optionFilterProp="label"
              options={items.map((item) => ({
                value: item.item_id,
                label: `${item.item_code} - ${item.item_name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="supplier_id"
            label="공급업체"
            rules={[{ required: true, message: '공급업체를 선택하세요' }]}
          >
            <Select
              showSearch
              placeholder="공급업체 선택"
              optionFilterProp="label"
              options={suppliers.map((s) => ({
                value: s.supplier_id,
                label: s.supplier_name,
              }))}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="quantity"
              label="수량"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '수량을 입력하세요' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="unit_price"
              label="단가"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '단가를 입력하세요' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>

            <Form.Item name="currency" label="통화" style={{ flex: 0.6 }}>
              <Select>
                {CURRENCY_OPTIONS.map((c) => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
            합계금액: <strong>{calcTotal.toLocaleString()}</strong>{' '}
            {form.getFieldValue('currency') ?? 'KRW'}
          </div>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={3} placeholder="비고 입력 (선택)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InboundPage;
