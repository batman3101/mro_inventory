import { useState, useEffect } from 'react';
import {
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
import { ResizableTable } from '@/components/ResizableTable';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { Supplier } from '@/types/database.types';
import { useSupplierStore } from '@/store/suppliers.store';

const { Option } = Select;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'red',
};

interface SupplierFormValues {
  supplier_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  website: string;
  status: string;
}

const Suppliers = () => {
  const { t } = useTranslation();
  const { suppliers, isLoading, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } =
    useSupplierStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SupplierFormValues>();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      searchQuery === '' ||
      s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.supplier_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === undefined || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreateModal = () => {
    setEditingSupplier(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    form.setFieldsValue({
      supplier_name: supplier.supplier_name,
      contact_person: supplier.contact_person,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      country: supplier.country,
      website: supplier.website,
      status: supplier.status,
    });
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingSupplier(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    let values: SupplierFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.supplier_id, values);
        message.success(t('suppliers.updateSuccess'));
      } else {
        await createSupplier({
          supplier_code: '',
          supplier_name: values.supplier_name,
          contact_person: values.contact_person ?? '',
          email: values.email ?? '',
          phone: values.phone ?? '',
          address: values.address ?? '',
          country: values.country ?? '',
          website: values.website ?? '',
          status: values.status ?? 'ACTIVE',
          location_id: '',
          created_by: '',
        });
        message.success(t('suppliers.createSuccess'));
      }
      handleModalCancel();
    } catch {
      message.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    try {
      await deleteSupplier(supplierId);
      message.success(t('suppliers.deleteSuccess'));
    } catch {
      message.error(t('common.error'));
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'ACTIVE') return t('common.active');
    if (status === 'INACTIVE') return t('common.inactive');
    return status;
  };

  const columns: ColumnsType<Supplier> = [
    {
      title: t('suppliers.supplierCode'),
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      width: 140,
      sorter: (a, b) => a.supplier_code.localeCompare(b.supplier_code),
    },
    {
      title: t('suppliers.supplierName'),
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
      sorter: (a, b) => a.supplier_name.localeCompare(b.supplier_name),
    },
    {
      title: t('suppliers.contactPerson'),
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 120,
    },
    {
      title: t('auth.email'),
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: t('suppliers.phone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>
          {getStatusLabel(status)}
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
            title={t('suppliers.deleteConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.supplier_id)}
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
        items={[{ title: t('common.appName') }, { title: t('suppliers.title') }]}
      />
      <h2 style={{ marginBottom: 16 }}>{t('suppliers.title')}</h2>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('suppliers.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder={t('common.status')}
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
          >
            <Option value="ACTIVE">{t('common.active')}</Option>
            <Option value="INACTIVE">{t('common.inactive')}</Option>
          </Select>
          <div style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </div>
        </div>

        <ResizableTable<Supplier>
          rowKey="supplier_id"
          columns={columns}
          dataSource={filteredSuppliers}
          loading={isLoading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => t('common.total', { count: total }) }}
        />
      </Card>

      <Modal
        title={editingSupplier ? t('suppliers.editSupplier') : t('suppliers.createSupplier')}
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
          <Form.Item
            name="supplier_name"
            label={t('suppliers.supplierName')}
            rules={[{ required: true, message: t('suppliers.supplierNameRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="contact_person" label={t('suppliers.contactPerson')}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('auth.email')}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label={t('suppliers.phone')}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('suppliers.address')}>
            <Input />
          </Form.Item>
          <Form.Item name="country" label={t('suppliers.country')}>
            <Input />
          </Form.Item>
          <Form.Item name="website" label={t('suppliers.website')}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')}>
            <Select>
              <Option value="ACTIVE">{t('common.active')}</Option>
              <Option value="INACTIVE">{t('common.inactive')}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Suppliers;
