import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Tag,
  Space,
  Popconfirm,
  message,
  Card,
  Breadcrumb,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { ColumnsType } from 'antd/es/table';
import type { Item, Category } from '@/types/database.types';
import { getAllItems, createItem, updateItem, deleteItem } from '@/services/items.service';
import { supabase } from '@/lib/supabase';

const { Option } = Select;

const itemFormSchema = z.object({
  item_name: z.string().min(1, '소모품명을 입력하세요'),
  unit: z.string().min(1, '단위를 입력하세요'),
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
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'red',
  DISCONTINUED: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  DISCONTINUED: '단종',
};

const Items = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<ItemFormValues>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedItems, { data: fetchedCategories }] = await Promise.all([
        getAllItems(),
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      ]);
      setItems(fetchedItems);
      setCategories(fetchedCategories ?? []);
    } catch (err) {
      message.error('데이터 불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === undefined || item.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.category_id === categoryId)?.category_name ?? categoryId;
  };

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);
    form.setFieldsValue({
      item_name: item.item_name,
      korean_name: item.korean_name,
      vietnamese_name: item.vietnamese_name,
      category_id: item.category_id,
      spec: item.spec,
      unit: item.unit,
      min_stock: item.min_stock,
      max_stock: item.max_stock,
      reorder_point: item.reorder_point,
      storage_location: item.storage_location,
      status: item.status,
      description: item.description,
    });
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    let values: ItemFormValues;
    try {
      const raw = await form.validateFields();
      values = itemFormSchema.parse(raw);
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.item_id, values);
        message.success('소모품이 수정되었습니다.');
      } else {
        await createItem({
          ...values,
          item_code: '',
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
        message.success('소모품이 등록되었습니다.');
      }
      handleModalCancel();
      fetchData();
    } catch (err) {
      message.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await deleteItem(itemId);
      message.success('소모품이 삭제되었습니다.');
      setItems((prev) => prev.filter((item) => item.item_id !== itemId));
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const handleExport = () => {
    const exportData = filteredItems.map((item) => ({
      소모품코드: item.item_code,
      소모품명: item.item_name,
      카테고리: getCategoryName(item.category_id),
      규격: item.spec,
      단위: item.unit,
      최소재고: item.min_stock,
      재주문점: item.reorder_point,
      상태: STATUS_LABEL[item.status] ?? item.status,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '소모품목록');
    XLSX.writeFile(wb, 'MRO_소모품_목록.xlsx');
  };

  const columns: ColumnsType<Item> = [
    {
      title: '소모품코드',
      dataIndex: 'item_code',
      key: 'item_code',
      width: 140,
      sorter: (a, b) => a.item_code.localeCompare(b.item_code),
    },
    {
      title: '소모품명',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 180,
      sorter: (a, b) => a.item_name.localeCompare(b.item_name),
    },
    {
      title: '카테고리',
      dataIndex: 'category_id',
      key: 'category_id',
      width: 130,
      render: (id: string) => getCategoryName(id),
    },
    {
      title: '규격',
      dataIndex: 'spec',
      key: 'spec',
      width: 120,
    },
    {
      title: '단위',
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
    },
    {
      title: '최소재고',
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 90,
      align: 'right',
    },
    {
      title: '재주문점',
      dataIndex: 'reorder_point',
      key: 'reorder_point',
      width: 90,
      align: 'right',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>
          {STATUS_LABEL[status] ?? status}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="이 소모품을 삭제하시겠습니까?"
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.item_id)}
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
        items={[{ title: t('common.appName') }, { title: t('menu.items') }]}
      />
      <h2 style={{ marginBottom: 16 }}>소모품 관리</h2>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="소모품명 또는 코드 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="카테고리 선택"
            allowClear
            style={{ width: 160 }}
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
          >
            {categories.map((cat) => (
              <Option key={cat.category_id} value={cat.category_id}>
                {cat.category_name}
              </Option>
            ))}
          </Select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              {t('common.export')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </div>
        </div>

        <Table<Item>
          rowKey="item_id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `총 ${total}건` }}
        />
      </Card>

      <Modal
        title={editingItem ? '소모품 수정' : '소모품 등록'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="item_name" label="소모품명" rules={[{ required: true, message: '소모품명을 입력하세요' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="korean_name" label="한국어명">
            <Input />
          </Form.Item>
          <Form.Item name="vietnamese_name" label="베트남어명">
            <Input />
          </Form.Item>
          <Form.Item name="category_id" label="카테고리">
            <Select placeholder="카테고리 선택" allowClear>
              {categories.map((cat) => (
                <Option key={cat.category_id} value={cat.category_id}>
                  {cat.category_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="spec" label="규격">
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="단위" rules={[{ required: true, message: '단위를 입력하세요' }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Form.Item name="min_stock" label="최소재고">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="max_stock" label="최대재고">
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="reorder_point" label="재주문점">
              <Input type="number" min={0} />
            </Form.Item>
          </div>
          <Form.Item name="storage_location" label="보관위치">
            <Input />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')}>
            <Select>
              <Option value="ACTIVE">활성</Option>
              <Option value="INACTIVE">비활성</Option>
              <Option value="DISCONTINUED">단종</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Items;
