import { useState, useEffect, useMemo } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button, Input, Form, Tag, Space, Popconfirm, message, Card, InputNumber, Switch, Tooltip,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { ColumnsType } from 'antd/es/table';
import type { Category } from '@/types/database.types';
import {
  getAllCategories, createCategory, updateCategory, deleteCategory,
} from '@/services/categories.service';

// Flat category structure — no parent/child hierarchy. The DB column
// `parent_id` is kept nullable for forward compatibility but always sent NULL.
const formSchema = z.object({
  category_code: z.string().min(1),
  category_name: z.string().min(1), // ko (required, fallback)
  category_name_vi: z.string().optional().default(''), // vi (optional)
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});
type FormValues = z.infer<typeof formSchema>;

const Categories = () => {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language?.startsWith('vi');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const fetchData = async () => {
    setLoading(true);
    try {
      setCategories(await getAllCategories());
    } catch (e) {
      console.error('categories fetch failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        category_code: editing.category_code,
        category_name: editing.category_name,
        category_name_vi: editing.category_name_vi ?? '',
        sort_order: editing.sort_order ?? 0,
        is_active: editing.is_active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ sort_order: 0, is_active: true });
    }
  }, [modalOpen, editing, form]);

  // Display name resolves to user's locale; falls back to ko (category_name).
  const displayName = (c: Category) =>
    isVi && c.category_name_vi ? c.category_name_vi : c.category_name;

  const filtered = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.category_code.toLowerCase().includes(q) ||
        c.category_name.toLowerCase().includes(q) ||
        (c.category_name_vi ?? '').toLowerCase().includes(q),
    );
  }, [categories, searchQuery]);
  void displayName; // available for future locale-sensitive renders

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setModalOpen(true); };
  const close = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = async () => {
    let values: FormValues;
    try {
      values = formSchema.parse(await form.validateFields());
    } catch (e) {
      console.error('category form validation failed:', e);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        category_code: values.category_code,
        category_name: values.category_name,
        category_name_vi: values.category_name_vi?.trim() ? values.category_name_vi.trim() : null,
        parent_id: null, // flat hierarchy
        sort_order: values.sort_order,
        is_active: values.is_active,
      };
      if (editing) {
        await updateCategory(editing.category_id, payload);
        message.success(t('categories.updateSuccess'));
      } else {
        await createCategory(payload);
        message.success(t('categories.createSuccess'));
      }
      close();
      fetchData();
    } catch (e) {
      console.error('category submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success(t('categories.deleteSuccess'));
      setCategories((prev) => prev.filter((c) => c.category_id !== id));
    } catch (e) {
      console.error('category delete failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const columns: ColumnsType<Category> = [
    {
      title: t('categories.categoryCode'),
      dataIndex: 'category_code',
      key: 'category_code',
      width: 140,
      sorter: (a, b) => a.category_code.localeCompare(b.category_code),
    },
    {
      title: t('categories.categoryNameKo'),
      dataIndex: 'category_name',
      key: 'category_name',
      width: 200,
      sorter: (a, b) => a.category_name.localeCompare(b.category_name),
    },
    {
      title: t('categories.categoryNameVi'),
      dataIndex: 'category_name_vi',
      key: 'category_name_vi',
      width: 200,
      render: (v: string | null) => v || <span style={{ color: '#ccc' }}>—</span>,
      sorter: (a, b) => (a.category_name_vi ?? '').localeCompare(b.category_name_vi ?? ''),
    },
    {
      title: t('categories.sortOrder'),
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
      align: 'right',
      sorter: (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (v: boolean) =>
        v ? <Tag color="blue">{t('common.active')}</Tag> : <Tag>{t('common.inactive')}</Tag>,
      filters: [
        { text: t('common.active'), value: true },
        { text: t('common.inactive'), value: false },
      ],
      onFilter: (value, r) => r.is_active === value,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('common.edit')}>
            <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title={t('categories.deleteConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.category_id)}
          >
            <Tooltip title={t('common.delete')}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t('categories.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {t('categories.createCategory')}
        </Button>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('categories.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <span style={{ color: '#666', fontSize: 13 }}>
            {t('common.total', { count: filtered.length })}
          </span>
        </div>

        <ResizableTable<Category>
          rowKey="category_id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => t('common.total', { count: total }),
          }}
        />
      </Card>

      <DraggableModal
        title={editing ? t('categories.editCategory') : t('categories.createCategory')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={close}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
          <Form.Item
            name="category_code"
            label={t('categories.categoryCode')}
            rules={[{ required: true, message: t('categories.categoryCodeRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category_name"
            label={t('categories.categoryNameKo')}
            rules={[{ required: true, message: t('categories.categoryNameRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="category_name_vi" label={t('categories.categoryNameVi')}>
            <Input placeholder="—" />
          </Form.Item>
          <Form.Item name="sort_order" label={t('categories.sortOrder')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label={t('categories.isActive')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </DraggableModal>
    </div>
  );
};

export default Categories;
