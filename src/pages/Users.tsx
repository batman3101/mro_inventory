import { useState, useEffect } from 'react';
import { DraggableModal } from "@/components/DraggableModal";
import {
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
  Popconfirm,
  Tooltip,
  Typography,
} from 'antd';
import { ResizableTable } from '@/components/ResizableTable';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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

interface UserFormValues {
  username: string;
  full_name: string;
  email: string;
  password?: string;
  password_confirm?: string;
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

  const {
    users,
    isLoading,
    fetchUsers,
    createUser,
    updateUser,
    deactivateUser,
    activateUser,
    deleteUser,
  } = useUsersStore();
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

  useEffect(() => {
    if (!modalOpen) return;
    if (editingUser) {
      form.setFieldsValue({
        username: editingUser.username,
        full_name: editingUser.full_name,
        email: editingUser.email,
        role: editingUser.role,
        department_id: editingUser.department_id ?? undefined,
        location_id: editingUser.location_id ?? undefined,
        phone_number: editingUser.phone_number ?? undefined,
        position: editingUser.position ?? undefined,
        is_active: editingUser.is_active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ is_active: true, role: 'user' });
    }
  }, [modalOpen, editingUser, form]);

  const openCreateModal = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user: SafeUser) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async () => {
    let values: UserFormValues;
    try {
      values = await form.validateFields();
    } catch (e) {
      console.error('user form validation failed:', e);
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
        message.success(t('users.updateSuccess'));
      } else {
        await createUser({
          username: values.username,
          full_name: values.full_name,
          email: values.email,
          password: values.password ?? '',
          role: values.role,
          department_id: values.department_id ?? null,
          location_id: values.location_id ?? null,
          phone_number: values.phone_number ?? '',
          position: values.position ?? null,
          is_active: values.is_active,
        });
        message.success(t('users.createSuccess'));
      }
      handleModalCancel();
      fetchUsers();
    } catch (e) {
      console.error('user submit failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: SafeUser) => {
    try {
      if (user.is_active) {
        await deactivateUser(user.user_id);
        message.success(t('users.deactivateSuccess'));
      } else {
        await activateUser(user.user_id);
        message.success(t('users.activateSuccess'));
      }
    } catch (e) {
      console.error('user toggle active failed:', e);
      message.error(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const handleDelete = async (user: SafeUser) => {
    try {
      await deleteUser(user.user_id);
      message.success(t('users.deleteSuccess'));
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const columns: ColumnsType<SafeUser> = [
    {
      title: t('users.username'),
      dataIndex: 'username',
      key: 'username',
      width: 130,
      sorter: (a, b) => a.username.localeCompare(b.username),
    },
    {
      title: t('users.fullName'),
      dataIndex: 'full_name',
      key: 'full_name',
      width: 130,
    },
    {
      title: t('auth.email'),
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: t('users.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={ROLE_COLOR[role] ?? 'default'}>{t(`users.roles.${role}` as never) ?? role}</Tag>
      ),
    },
    {
      title: t('outbound.department'),
      dataIndex: 'department_id',
      key: 'department_id',
      width: 130,
      render: (deptId: string | null) => {
        const dept = departments.find((d) => d.department_id === deptId);
        return dept ? dept.department_name : '-';
      },
    },
    {
      title: t('users.position'),
      dataIndex: 'position',
      key: 'position',
      width: 110,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? t('common.active') : t('common.inactive')}</Tag>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: t('common.actions'),
            key: 'actions',
            width: 160,
            fixed: 'right' as const,
            render: (_: unknown, record: SafeUser) => {
              const isSelf = authUser?.user_id === record.user_id;
              const canDelete = !record.is_active && !isSelf;
              const deleteTooltip = isSelf
                ? t('users.deleteSelfDisabled')
                : record.is_active
                  ? t('users.deleteActiveDisabled')
                  : '';

              return (
                <Space size="small">
                  <Tooltip title={t('common.edit')}>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(record)}
                    />
                  </Tooltip>
                  {canDelete ? (
                    <Popconfirm
                      title={t('users.deleteConfirmTitle')}
                      description={t('users.deleteConfirm', { username: record.username })}
                      okText={t('common.delete')}
                      cancelText={t('common.cancel')}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(record)}
                    >
                      <Tooltip title={t('common.delete')}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  ) : (
                    <Tooltip title={deleteTooltip}>
                      <Button type="text" disabled icon={<DeleteOutlined />} />
                    </Tooltip>
                  )}
                  <Button
                    type="text"
                    danger={record.is_active}
                    onClick={() => handleToggleActive(record)}
                  >
                    {record.is_active ? t('users.deactivate') : t('users.activate')}
                  </Button>
                </Space>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: t('common.appName') }, { title: t('users.title') }]}
      />
      <Typography.Title level={3} style={{ marginBottom: 16 }}>{t('users.title')}</Typography.Title>

      <Card>
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              {t('common.create')}
            </Button>
          </div>
        )}

        <ResizableTable<SafeUser>
          rowKey="user_id"
          columns={columns}
          dataSource={users}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => t('common.total', { count: total }),
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {isAdmin && (
        <DraggableModal
          title={editingUser ? t('users.editUser') : t('users.createUser')}
          open={modalOpen}
          onOk={handleSubmit}
          onCancel={handleModalCancel}
          okText={t('common.save')}
          cancelText={t('common.cancel')}
          confirmLoading={submitting}
          forceRender
        >
          <Form form={form} layout="vertical" preserve={false} style={{ marginTop: 8 }}>
            <Form.Item
              name="username"
              label={t('users.username')}
              rules={[{ required: true, message: t('users.usernameRequired') }]}
            >
              <Input disabled={!!editingUser} />
            </Form.Item>
            <Form.Item
              name="full_name"
              label={t('users.fullName')}
              rules={[{ required: true, message: t('users.fullNameRequired') }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label={t('auth.email')}
              rules={[
                { required: true, message: t('users.emailRequired') },
                { type: 'email', message: t('users.emailInvalid') },
              ]}
            >
              <Input />
            </Form.Item>
            {!editingUser && (
              <>
                <Form.Item
                  name="password"
                  label={t('auth.password')}
                  rules={[
                    { required: true, message: t('users.passwordRequired') },
                    { min: 6, message: t('users.passwordMinLength') },
                  ]}
                  hasFeedback
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  name="password_confirm"
                  label={t('users.passwordConfirm')}
                  dependencies={['password']}
                  hasFeedback
                  rules={[
                    { required: true, message: t('users.passwordConfirmRequired') },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error(t('users.passwordMismatch')));
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </>
            )}
            <Form.Item
              name="role"
              label={t('users.role')}
              rules={[{ required: true, message: t('users.roleRequired') }]}
            >
              <Select>
                <Option value="system_admin">{t('users.roles.system_admin')}</Option>
                <Option value="admin">{t('users.roles.admin')}</Option>
                <Option value="user">{t('users.roles.user')}</Option>
                <Option value="viewer">{t('users.roles.viewer')}</Option>
              </Select>
            </Form.Item>
            <Form.Item name="department_id" label={t('outbound.department')}>
              <Select allowClear placeholder={t('departments.selectDepartment')}>
                {departments.map((d) => (
                  <Option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="location_id" label={t('inventory.storageLocation')}>
              <Select allowClear placeholder={t('common.selectLocation')}>
                {locations.map((l) => (
                  <Option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="phone_number" label={t('users.phone')}>
              <Input />
            </Form.Item>
            <Form.Item name="position" label={t('users.position')}>
              <Input />
            </Form.Item>
            <Form.Item name="is_active" label={t('users.isActive')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </DraggableModal>
      )}
    </div>
  );
};

export default Users;
