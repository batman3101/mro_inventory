import { useState } from 'react';
import { Form, Input, Button, Alert, Typography, Result } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

const { Text } = Typography;

interface SignupFormValues {
  full_name: string;
  email: string;
  password: string;
  password_confirm: string;
}

// Self sign-up. The DB trigger creates an INACTIVE viewer profile for the new
// account, so nothing is visible until a system_admin approves it on the
// Users page (sets active, role and factory).
const Signup = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<SignupFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'pending' | 'checkEmail' | null>(null);

  const handleSubmit = async (values: SignupFormValues) => {
    setSubmitting(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { full_name: values.full_name.trim() } },
    });
    setSubmitting(false);

    if (signUpError) {
      console.error('회원가입 실패:', signUpError);
      if (/already registered|already exists/i.test(signUpError.message)) {
        setError(t('errors.auth.alreadyRegistered'));
      } else if (/signups? not allowed|signup.*disabled/i.test(signUpError.message)) {
        setError(t('errors.auth.signupDisabled'));
      } else {
        setError(t('errors.auth.signupFailed', { message: signUpError.message }));
      }
      return;
    }

    // With e-mail confirmation off Supabase signs the new user in right away;
    // the account cannot use the app before approval, so sign out again.
    if (data.session) {
      await supabase.auth.signOut();
      setDone('pending');
    } else {
      setDone('checkEmail');
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        {done ? (
          <Result
            status="success"
            title={t('auth.signupDoneTitle')}
            subTitle={t(done === 'pending' ? 'auth.signupPendingDesc' : 'auth.signupCheckEmailDesc')}
            extra={<Link to="/login">{t('auth.backToLogin')}</Link>}
          />
        ) : (
          <>
            <div className="auth-head">
              <h1>{t('auth.signup')}</h1>
              <Text type="secondary">{t('auth.signupSubtitle')}</Text>
            </div>

            {error && <Alert message={error} type="error" showIcon className="page-gap" />}

            <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
              <Form.Item
                name="full_name"
                label={t('auth.fullName')}
                rules={[{ required: true, whitespace: true, message: t('auth.fullName') }, { max: 100 }]}
              >
                <Input prefix={<UserOutlined />} placeholder={t('auth.fullName')} size="large" autoComplete="name" />
              </Form.Item>

              <Form.Item
                name="email"
                label={t('auth.email')}
                rules={[
                  { required: true, message: t('auth.email') },
                  { type: 'email', message: t('auth.email') },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder={t('auth.email')} size="large" autoComplete="email" />
              </Form.Item>

              <Form.Item
                name="password"
                label={t('auth.password')}
                rules={[{ required: true, min: 6, message: t('auth.passwordMin') }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} size="large" autoComplete="new-password" />
              </Form.Item>

              <Form.Item
                name="password_confirm"
                label={t('auth.passwordConfirm')}
                dependencies={['password']}
                rules={[
                  { required: true, message: t('auth.passwordConfirm') },
                  ({ getFieldValue }) => ({
                    validator: (_, value) =>
                      !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('auth.passwordMismatch'))),
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder={t('auth.passwordConfirm')} size="large" autoComplete="new-password" />
              </Form.Item>

              <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                {t('auth.signupButton')}
              </Button>
            </Form>
            <div className="auth-foot">
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Signup;
