import { Form, Input, Button, Alert, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';

const { Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [form] = Form.useForm<LoginFormValues>();

  const handleSubmit = async (values: LoginFormValues) => {
    const success = await login(values.email, values.password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-logo" role="img" aria-label="ALMUS" />
          <h1>MRO Inventory</h1>
          <Text type="secondary">{t('components.loginSubtitle')}</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon className="page-gap" />}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={t('auth.email')}
            rules={[
              { required: true, message: t('auth.email') },
              { type: 'email', message: t('auth.email') },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t('auth.email')}
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.password') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.password')}
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={isLoading}
          >
            {t('auth.loginButton')}
          </Button>
        </Form>
        <div className="auth-foot">
          <Text type="secondary">{t('auth.noAccount')} </Text>
          <Link to="/signup">{t('auth.signup')}</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
