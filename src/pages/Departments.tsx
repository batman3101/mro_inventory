import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Breadcrumb,
} from 'antd';
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
      message.error('부서 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    form.setFieldsValue({
      department_code: dept.department_code,
      department_name: dept.department_name,
      description: dept.description ?? '',
    });
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingDept(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    let values: DepartmentFormValues;
    try {
      values = await form.validateFields();
    } catch {
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
        message.success('부서가 수정되었습니다.');
      } else {
        await createDepartment({
          department_code: values.department_code,
          department_name: values.department_name,
          description: values.description ?? null,
        });
        message.success('부서가 등록되었습니다.');
      }
      handleModalCancel();
      fetchData();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (departmentId: string) => {
    try {
      await deleteDepartment(departmentId);
      message.success('부서가 삭제되었습니다.');
      setDepartments((prev) => prev.filter((d) => d.department_id !== departmentId));
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const columns: ColumnsType<Department> = [
    {
      title: '부서코드',
      dataIndex: 'department_code',
      key: 'department_code',
      width: 140,
      sorter: (a, b) => a.department_code.localeCompare(b.department_code),
    },
    {
      title: '부서명',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 200,
      sorter: (a, b) => a.department_name.localeCompare(b.department_name),
    },
    {
      title: '설명',
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
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="이 부서를 삭제하시겠습니까?"
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record.department_id)}
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
        items={[{ title: t('common.appName') }, { title: '부서 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>부서 관리</h2>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            {t('common.create')}
          </Button>
        </div>

        <Table<Department>
          rowKey="department_id"
          columns={columns}
          dataSource={departments}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}건`,
          }}
        />
      </Card>

      <Modal
        title={editingDept ? '부서 수정' : '부서 등록'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleModalCancel}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="department_code"
            label="부서코드"
            rules={[{ required: true, message: '부서코드를 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="department_name"
            label="부서명"
            rules={[{ required: true, message: '부서명을 입력하세요' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="설명">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Departments;
