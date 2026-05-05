import { useState, useEffect } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Breadcrumb,
  Tooltip,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { Department } from '@/types/database.types';
import {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/services/departments.service';

interface DepartmentFormValues {
  department_code: string;
  department_name: string;
  description?: string;
}

const Departments = () => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<DepartmentFormValues>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAllDepartments();
      setDepartments(data);
    } catch {
      message.error(t('departments.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    if (editingDept) {
      form.setFieldsValue({
        department_code: editingDept.department_code,
        department_name: editingDept.department_name,
        description: editingDept.description ?? '',
      });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editingDept, form]);

  const openCreateModal = () => {
    setEditingDept(null);
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingDept(null);
  };

  const handleSubmit = async () => {
    let values: DepartmentFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('department form validation failed:', e);
      return;
    }

    setSubmitting(true);
    try {
      if (editingDept) {
        await updateDepartment(editingDept.department_id, {
          department_code: values.department_code,
          department_name: values.department_name,
          description: values.description ?? null,
        });
        message.success(t('departments.updateSuccess'));
      } else {
        await createDepartment({
          department_code: values.department_code,
          department_name: values.department_name,
          description: values.description ?? null,
        });
        message.success(t('departments.createSuccess'));
      }
      handleModalCancel();
      fetchData();
    } catch (e) {
      console.error('department submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (departmentId: string) => {
    try {
      await deleteDepartment(departmentId);
      message.success(t('departments.deleteSuccess'));
      setDepartments((prev) => prev.filter((d) => d.department_id !== departmentId));
    } catch (e) {
      console.error('department delete failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const columns: ColumnsType<Department> = [
    {
      title: t('departments.departmentCode'),
      dataIndex: 'department_code',
      key: 'department_code',
      width: 140,
      sorter: (a, b) => a.department_code.localeCompare(b.department_code),
    },
    {
      title: t('departments.departmentName'),
      dataIndex: 'department_name',
      key: 'department_name',
      width: 200,
      sorter: (a, b) => a.department_name.localeCompare(b.department_name),
    },
    {
      title: t('items.description'),
      dataIndex: 'description',
      key: 'description',
      render: (val: string | null) => val ?? '-',
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
            title={t('departments.deleteConfirm')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.department_id)}
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
        items={[{ title: t('common.appName') }, { title: t('departments.title') }]}
      />
      <h2 style={{ marginBottom: 16 }}>{t('departments.title')}</h2>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            {t('common.create')}
          </Button>
        </div>

        <ResizableTable<Department>
          rowKey="department_id"
          columns={columns}
          dataSource={departments}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => t('common.total', { count: total }),
          }}
        />
      </Card>

      <DraggableModal
        title={editingDept ? t('departments.editDepartment') : t('departments.createDepartment')}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
          <Form.Item
            name="department_code"
            label={t('departments.departmentCode')}
            rules={[{ required: true, message: t('departments.departmentCodeRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="department_name"
            label={t('departments.departmentName')}
            rules={[{ required: true, message: t('departments.departmentNameRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('items.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </DraggableModal>
    </div>
  );
};

export default Departments;
