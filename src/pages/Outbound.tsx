import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
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
  Alert,
} from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
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

const Outbound = () => {
  const { outboundRecords, isLoading, fetchOutbound, createOutbound, deleteOutbound } =
    useOutboundStore();

  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<{ location_id: string; location_name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [form] = Form.useForm<OutboundFormValues>();
  const watchedItemId = Form.useWatch('item_id', form);
  const watchedQty = Form.useWatch('quantity', form);

  const fetchData = async () => {
    try {
      const [fetchedItems, fetchedDepartments, { data: fetchedLocations }] = await Promise.all([
        getAllItems(),
        getAllDepartments(),
        supabase.from('locations').select('location_id, location_name').eq('is_active', true),
      ]);
      setItems(fetchedItems);
      setDepartments(fetchedDepartments);
      setLocations(fetchedLocations ?? []);
    } catch {
      message.error('데이터 불러오기에 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchOutbound();
    fetchData();
  }, []);

  useEffect(() => {
    if (!watchedItemId || !selectedLocationId) {
      setCurrentStock(null);
      return;
    }
    checkStock(watchedItemId, selectedLocationId)
      .then(setCurrentStock)
      .catch(() => setCurrentStock(null));
  }, [watchedItemId, selectedLocationId]);

  const filteredRecords = outboundRecords.filter((r) => {
    const matchesSearch =
      searchQuery === '' ||
      r.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.requester.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate =
      !dateRange ||
      !dateRange[0] ||
      !dateRange[1] ||
      (r.outbound_date >= dateRange[0].format('YYYY-MM-DD') &&
        r.outbound_date <= dateRange[1].format('YYYY-MM-DD'));
    return matchesSearch && matchesDate;
  });

  const openCreateModal = () => {
    form.resetFields();
    setCurrentStock(null);
    setSelectedLocationId('');
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    form.resetFields();
    setCurrentStock(null);
    setSelectedLocationId('');
  };

  const handleSubmit = async () => {
    let values: OutboundFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (!selectedLocationId) {
      message.warning('위치를 선택하세요.');
      return;
    }

    setSubmitting(true);
    try {
      await createOutbound({
        item_id: values.item_id,
        location_id: selectedLocationId,
        quantity: values.quantity,
        requester: values.requester,
        department_id: values.department_id ?? null,
        purpose: values.purpose ?? '',
        cost_center: values.cost_center ?? '',
        outbound_date: values.outbound_date.format('YYYY-MM-DD'),
        reference_number: '',
        notes: values.notes ?? '',
        created_by: '',
      });
      message.success('출고가 등록되었습니다.');
      handleModalCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '출고 등록에 실패했습니다.';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOutbound(id);
      message.success('출고가 삭제되었습니다.');
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const stockInsufficient =
    currentStock !== null && watchedQty !== undefined && watchedQty > currentStock;

  const columns: ColumnsType<Outbound> = [
    {
      title: '출고번호',
      dataIndex: 'reference_number',
      key: 'reference_number',
      width: 160,
    },
    {
      title: '출고일',
      dataIndex: 'outbound_date',
      key: 'outbound_date',
      width: 110,
      sorter: (a, b) => a.outbound_date.localeCompare(b.outbound_date),
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
      title: '수량',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'right',
      render: (qty: number, record) => `${qty} ${record.item_unit}`,
    },
    {
      title: '요청자',
      dataIndex: 'requester',
      key: 'requester',
      width: 110,
    },
    {
      title: '부서',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 130,
    },
    {
      title: '사용목적',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 150,
    },
    {
      title: '코스트센터',
      dataIndex: 'cost_center',
      key: 'cost_center',
      width: 120,
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
    },
    {
      title: '작업',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="이 출고 기록을 삭제하시겠습니까?"
          okText="확인"
          cancelText="취소"
          onConfirm={() => handleDelete(record.outbound_id)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: 'MRO 재고관리' }, { title: '출고 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>출고 관리</h2>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="품목명, 코드, 출고번호, 요청자 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range as [Dayjs | null, Dayjs | null] | null)}
            style={{ width: 240 }}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              출고 등록
            </Button>
          </div>
        </div>

        <Table<Outbound>
          rowKey="outbound_id"
          columns={columns}
          dataSource={filteredRecords}
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>

      <Modal
        title="출고 등록"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText="저장"
        cancelText="취소"
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="item_id"
            label="품목"
            rules={[{ required: true, message: '품목을 선택하세요' }]}
          >
            <Select
              showSearch
              placeholder="품목코드 또는 품목명 검색"
              optionFilterProp="label"
              options={items.map((item) => ({
                value: item.item_id,
                label: `${item.item_code} - ${item.item_name}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="위치"
            required
          >
            <Select
              placeholder="위치 선택"
              value={selectedLocationId || undefined}
              onChange={setSelectedLocationId}
            >
              {locations.map((loc) => (
                <Option key={loc.location_id} value={loc.location_id}>
                  {loc.location_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {currentStock !== null && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: currentStock > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
                현재 재고: {currentStock}
              </span>
            </div>
          )}

          <Form.Item
            name="quantity"
            label="수량"
            rules={[{ required: true, message: '수량을 입력하세요' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          {stockInsufficient && (
            <Alert
              type="warning"
              message={`재고 부족: 현재 재고(${currentStock})보다 많은 수량을 요청하고 있습니다.`}
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <Form.Item
            name="requester"
            label="요청자"
            rules={[{ required: true, message: '요청자를 입력하세요' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="department_id" label="부서">
            <Select placeholder="부서 선택" allowClear>
              {departments.map((dept) => (
                <Option key={dept.department_id} value={dept.department_id}>
                  {dept.department_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="purpose" label="사용목적">
            <Input />
          </Form.Item>

          <Form.Item name="cost_center" label="코스트센터">
            <Input />
          </Form.Item>

          <Form.Item
            name="outbound_date"
            label="출고일"
            initialValue={dayjs()}
            rules={[{ required: true, message: '출고일을 선택하세요' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Outbound;
