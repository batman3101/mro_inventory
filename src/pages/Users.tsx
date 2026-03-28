import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Space,
  message,
  Card,
  Breadcrumb,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { User } from '@/types/database.types';
import { useAuthStore } from '@/store/auth.store';
import { useUsersStore } from '@/store/users.store';
import { useDepartmentStore } from '@/store/departments.store';
import { useLocationStore } from '@/store/location.store';

type SafeUser = Omit<User, 'password_hash'>;

const { Option } = Select;

const ROLE_COLOR: Record<string, string> = {
  system_admin: 'red',
  admin: 'blue',
  user: 'green',
  viewer: 'default',
};

const ROLE_LABEL: Record<string, string> = {
  system_admin: '시스템관리자',
  admin: '관리자',
  user: '사용자',
  viewer: '조회자',
};

interface UserFormValues {
  username: string;
  full_name: string;
  email: string;
  role: string;
  department_id?: string;
  location_id?: string;
  phone_number?: string;
  position?: string;
  is_active: boolean;
}

const Users = () => {
  const { t } = useTranslation();
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === 'system_admin';

  const { users, isLoading, fetchUsers, createUser, updateUser, deactivateUser, activateUser } =
    useUsersStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const { locations } = useLocationStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<UserFormValues>();

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, role: 'user' });
    setModalOpen(true);
  };

  const openEditModal = (user: SafeUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department_id: user.department_id ?? undefined,
      location_id: user.location_id ?? undefined,
      phone_number: user.phone_number ?? undefined,
      position: user.position ?? undefined,
      is_active: user.is_active,
    });
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    let values: UserFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.user_id, {
          full_name: values.full_name,
          email: values.email,
          role: values.role,
          department_id: values.department_id ?? null,
          location_id: values.location_id ?? null,
          phone_number: values.phone_number ?? '',
          position: values.position ?? null,
          is_active: values.is_active,
        });
        message.success('사용자가 수정되었습니다.');
      } else {
        await createUser({
          username: values.username,
          full_name: values.full_name,
          email: values.email,
          role: values.role,
          department_id: values.department_id ?? null,
          location_id: values.location_id ?? null,
          phone_number: values.phone_number ?? '',
          position: values.position ?? null,
          is_active: values.is_active,
        });
        message.success('사용자가 등록되었습니다.');
      }
      handleModalCancel();
      fetchUsers();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: SafeUser) => {
    try {
      if (user.is_active) {
        await deactivateUser(user.user_id);
        message.success('사용자를 비활성화했습니다.');
      } else {
        await activateUser(user.user_id);
        message.success('사용자를 활성화했습니다.');
      }
    } catch {
      message.error('상태 변경에 실패했습니다.');
    }
  };

  const columns: ColumnsType<SafeUser> = [
    {
      title: '사용자명',
      dataIndex: 'username',
      key: 'username',
      width: 130,
      sorter: (a, b) => a.username.localeCompare(b.username),
    },
    {
      title: '이름',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 130,
    },
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '역할',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={ROLE_COLOR[role] ?? 'default'}>{ROLE_LABEL[role] ?? role}</Tag>
      ),
    },
    {
      title: '부서',
      dataIndex: 'department_id',
      key: 'department_id',
      width: 130,
      render: (deptId: string | null) => {
        const dept = departments.find((d) => d.department_id === deptId);
        return dept ? dept.department_name : '-';
      },
    },
    {
      title: '직위',
      dataIndex: 'position',
      key: 'position',
      width: 110,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: '상태',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '활성' : '비활성'}</Tag>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: t('common.actions'),
            key: 'actions',
            width: 120,
            fixed: 'right' as const,
            render: (_: unknown, record: SafeUser) => (
              <Space size="small">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEditModal(record)}
                />
                <Button
                  type="text"
                  danger={record.is_active}
                  onClick={() => handleToggleActive(record)}
                >
                  {record.is_active ? '비활성화' : '활성화'}
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: t('common.appName') }, { title: '사용자 관리' }]}
      />
      <h2 style={{ marginBottom: 16 }}>사용자 관리</h2>

      <Card>
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </div>
        )}

        <Table<SafeUser>
          rowKey="user_id"
          columns={columns}
          dataSource={users}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `총 ${total}건`,
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {isAdmin && (
        <Modal
          title={editingUser ? '사용자 수정' : '사용자 등록'}
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
              name="username"
              label="사용자명"
              rules={[{ required: true, message: '사용자명을 입력하세요' }]}
            >
              <Input disabled={!!editingUser} />
            </Form.Item>
            <Form.Item
              name="full_name"
              label="이름"
              rules={[{ required: true, message: '이름을 입력하세요' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="이메일"
              rules={[
                { required: true, message: '이메일을 입력하세요' },
                { type: 'email', message: '올바른 이메일 형식을 입력하세요' },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="role"
              label="역할"
              rules={[{ required: true, message: '역할을 선택하세요' }]}
            >
              <Select>
                <Option value="system_admin">시스템관리자</Option>
                <Option value="admin">관리자</Option>
                <Option value="user">사용자</Option>
                <Option value="viewer">조회자</Option>
              </Select>
            </Form.Item>
            <Form.Item name="department_id" label="부서">
              <Select allowClear placeholder="부서 선택">
                {departments.map((d) => (
                  <Option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="location_id" label="위치">
              <Select allowClear placeholder="위치 선택">
                {locations.map((l) => (
                  <Option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="phone_number" label="전화번호">
              <Input />
            </Form.Item>
            <Form.Item name="position" label="직위">
              <Input />
            </Form.Item>
            <Form.Item name="is_active" label="활성 상태" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      )}
    </div>
  );
};

export default Users;
