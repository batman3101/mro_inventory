import { useState, useEffect } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
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
import { Upload, Alert, List, Tooltip } from 'antd';
import * as XLSX from 'xlsx';
import { ResizableTable } from '@/components/ResizableTable';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { Supplier } from '@/types/database.types';
import { useSupplierStore } from '@/store/suppliers.store';
import { downloadSupplierImportTemplate, parseSupplierRow } from '@/utils/excelTemplates';
import { getOptionalLocationId } from '@/services/locationContext';

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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    total: number; success: number; failed: number; errors: string[];
  } | null>(null);

  const handleBulkUpload = async (file: File) => {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const existing = new Set(suppliers.map((s) => s.supplier_code));
      const locationId = getOptionalLocationId() ?? '';
      const errors: string[] = [];
      let success = 0;
      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const parsed = parseSupplierRow(rows[i]);
        if (!parsed.ok) {
          errors.push(t('suppliers.bulkErrorRow', { row: rowNum, msg: parsed.error }));
          continue;
        }
        const r = parsed.data;
        if (existing.has(r.supplierCode)) {
          errors.push(t('suppliers.bulkErrorRow', {
            row: rowNum,
            msg: `${r.supplierCode} (duplicate)`,
          }));
          continue;
        }
        try {
          await createSupplier({
            supplier_code: r.supplierCode,
            supplier_name: r.supplierName,
            contact_person: r.contactPerson,
            email: r.email,
            phone: r.phone,
            address: r.address,
            country: r.country,
            website: r.website,
            status: 'ACTIVE',
            location_id: locationId,
            created_by: '',
          });
          existing.add(r.supplierCode);
          success++;
        } catch (e) {
          errors.push(t('suppliers.bulkErrorRow', {
            row: rowNum,
            msg: e instanceof Error ? e.message : 'unknown',
          }));
        }
      }
      setBulkResult({ total: rows.length, success, failed: errors.length, errors });
      if (success > 0) fetchSuppliers();
    } catch (e) {
      console.error('supplier bulk parse failed:', e);
      message.error(t('suppliers.bulkParseFailed'));
    } finally {
      setBulkLoading(false);
    }
    return false;
  };

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

  // Hydrate form fields when modal opens; avoids "useForm not connected" warning
  // and the silent validateFields() failure that caused saves to drop.
  useEffect(() => {
    if (!modalOpen) return;
    if (editingSupplier) {
      form.setFieldsValue({
        supplier_name: editingSupplier.supplier_name,
        contact_person: editingSupplier.contact_person,
        email: editingSupplier.email,
        phone: editingSupplier.phone,
        address: editingSupplier.address,
        country: editingSupplier.country,
        website: editingSupplier.website,
        status: editingSupplier.status,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'ACTIVE' });
    }
  }, [modalOpen, editingSupplier, form]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async () => {
    let values: SupplierFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('supplier form validation failed:', e);
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
    } catch (e) {
      console.error('supplier submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: string) => {
    try {
      await deleteSupplier(supplierId);
      message.success(t('suppliers.deleteSuccess'));
    } catch (e) {
      console.error('supplier delete failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
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
          <Tooltip title={t('common.edit')}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('suppliers.deleteConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.supplier_id)}
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
          <Space style={{ marginLeft: 'auto' }}>
            <Button icon={<DownloadOutlined />} onClick={downloadSupplierImportTemplate}>
              {t('suppliers.supplierTemplate')}
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => { setBulkResult(null); setBulkOpen(true); }}
            >
              {t('suppliers.bulkUpload')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </Space>
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

      <DraggableModal
        title={editingSupplier ? t('suppliers.editSupplier') : t('suppliers.createSupplier')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        width={600}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
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
      </DraggableModal>

      <DraggableModal
        title={t('suppliers.bulkDialogTitle')}
        open={bulkOpen}
        onCancel={() => setBulkOpen(false)}
        footer={<Button onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>}
        width={680}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert type="info" showIcon message={t('suppliers.bulkHelp')} />
          <Upload.Dragger
            multiple={false}
            accept=".xlsx,.xls"
            showUploadList={false}
            disabled={bulkLoading}
            beforeUpload={(file) => { handleBulkUpload(file); return false; }}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">{t('suppliers.bulkDropHint')}</p>
          </Upload.Dragger>
          {bulkLoading && <Alert type="warning" message={t('suppliers.bulkProcessing')} />}
          {bulkResult && (
            <>
              <Alert
                type={bulkResult.failed === 0 ? 'success' : 'warning'}
                showIcon
                message={t('suppliers.bulkResultTitle')}
                description={t('suppliers.bulkSummary', {
                  total: bulkResult.total,
                  success: bulkResult.success,
                  failed: bulkResult.failed,
                })}
              />
              {bulkResult.errors.length > 0 && (
                <List
                  size="small"
                  bordered
                  dataSource={bulkResult.errors}
                  style={{ maxHeight: 240, overflowY: 'auto' }}
                  renderItem={(item) => (
                    <List.Item style={{ color: '#ff4d4f' }}>{item}</List.Item>
                  )}
                />
              )}
            </>
          )}
        </Space>
      </DraggableModal>
    </div>
  );
};

export default Suppliers;
