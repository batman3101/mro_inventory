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

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
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
        message.success('공급업체가 수정되었습니다.');
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
        message.success('공급업체가 등록되었습니다.');
      }
      handleModalCancel();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    try {
      await deleteSupplier(supplierId);
      message.success('공급업체가 삭제되었습니다.');
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const columns: ColumnsType<Supplier> = [
    {
      title: '공급업체코드',
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      width: 140,
      sorter: (a, b) => a.supplier_code.localeCompare(b.supplier_code),
    },
    {
      title: '공급업체명',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
      sorter: (a, b) => a.supplier_name.localeCompare(b.supplier_name),
    },
    {
      title: '담당자',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 120,
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '전화번호',
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
            title="이 공급업체를 삭제하시겠습니까?"
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
        items={[{ title: t('common.appName') }, { title: '공급업체 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>공급업체 관리</h2>

      <Card>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="공급업체명 또는 코드 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="상태 선택"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
          >
            <Option value="ACTIVE">활성</Option>
            <Option value="INACTIVE">비활성</Option>
          </Select>
          <div style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </div>
        </div>

        <Table<Supplier>
          rowKey="supplier_id"
          columns={columns}
          dataSource={filteredSuppliers}
          loading={isLoading}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `총 ${total}건` }}
        />
      </Card>

      <Modal
        title={editingSupplier ? '공급업체 수정' : '공급업체 등록'}
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
            label="공급업체명"
            rules={[{ required: true, message: '공급업체명을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="contact_person" label="담당자">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="이메일">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="전화번호">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="주소">
            <Input />
          </Form.Item>
          <Form.Item name="country" label="국가">
            <Input />
          </Form.Item>
          <Form.Item name="website" label="웹사이트">
            <Input />
          </Form.Item>
          <Form.Item name="status" label={t('common.status')}>
            <Select>
              <Option value="ACTIVE">활성</Option>
              <Option value="INACTIVE">비활성</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Suppliers;
