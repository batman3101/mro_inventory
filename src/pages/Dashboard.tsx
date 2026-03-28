import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Badge, Button, Space, Typography } from 'antd';
import {
  ShoppingCartOutlined,
  InboxOutlined,
  ExportOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { supabase } from '@/lib/supabase';
import { useInventoryStore } from '@/store/inventory.store';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ActivityItem {
  type: 'inbound' | 'outbound';
  item_name: string;
  quantity: number;
  created_at: string;
}

interface SummaryStats {
  totalItems: number;
  lowStockCount: number;
  monthlyInbound: number;
  monthlyOutbound: number;
}

const Dashboard = () => {
  const { alerts, fetchAlerts, acknowledgeAlert, resolveAlert } = useInventoryStore();
  const [stats, setStats] = useState<SummaryStats>({
    totalItems: 0,
    lowStockCount: 0,
    monthlyInbound: 0,
    monthlyOutbound: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        await fetchAlerts();

        const now = dayjs();
        const monthStart = now.startOf('month').toISOString();
        const monthEnd = now.endOf('month').toISOString();

        const [
          { count: totalItems },
          { count: lowStockCount },
          { count: monthlyInbound },
          { count: monthlyOutbound },
          { data: recentInbound },
          { data: recentOutbound },
        ] = await Promise.all([
          supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          supabase
            .from('inventory')
            .select('*, items!inner(reorder_point)', { count: 'exact', head: true })
            .filter('current_quantity', 'lt', 'items.reorder_point'),
          supabase
            .from('inbound')
            .select('*', { count: 'exact', head: true })
            .gte('inbound_date', now.startOf('month').format('YYYY-MM-DD'))
            .lte('inbound_date', now.endOf('month').format('YYYY-MM-DD')),
          supabase
            .from('outbound')
            .select('*', { count: 'exact', head: true })
            .gte('outbound_date', now.startOf('month').format('YYYY-MM-DD'))
            .lte('outbound_date', now.endOf('month').format('YYYY-MM-DD')),
          supabase
            .from('inbound')
            .select('item_name, quantity, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('outbound')
            .select('item_name, quantity, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setStats({
          totalItems: totalItems ?? 0,
          lowStockCount: lowStockCount ?? 0,
          monthlyInbound: monthlyInbound ?? 0,
          monthlyOutbound: monthlyOutbound ?? 0,
        });

        const inboundActivity: ActivityItem[] = (recentInbound ?? []).map((r) => ({
          type: 'inbound',
          item_name: r.item_name,
          quantity: r.quantity,
          created_at: r.created_at,
        }));

        const outboundActivity: ActivityItem[] = (recentOutbound ?? []).map((r) => ({
          type: 'outbound',
          item_name: r.item_name,
          quantity: r.quantity,
          created_at: r.created_at,
        }));

        const merged = [...inboundActivity, ...outboundActivity].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentActivity(merged.slice(0, 10));
      } catch (error) {
        console.error('대시보드 데이터 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
    } catch (error) {
      console.error('알림 확인 처리 실패:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'admin');
    } catch (error) {
      console.error('알림 해결 처리 실패:', error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Typography.Title level={2} style={{ marginBottom: '24px' }}>
        MRO 재고 대시보드
      </Typography.Title>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="총 소모품 수"
              value={stats.totalItems}
              prefix={<ShoppingCartOutlined />}
              suffix="종"
              valueStyle={{ color: '#2563eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="재고 부족 품목"
              value={stats.lowStockCount}
              prefix={<WarningOutlined />}
              suffix="종"
              valueStyle={{ color: stats.lowStockCount > 0 ? '#ef4444' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="이번 달 입고"
              value={stats.monthlyInbound}
              prefix={<InboxOutlined />}
              suffix="건"
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="이번 달 출고"
              value={stats.monthlyOutbound}
              prefix={<ExportOutlined />}
              suffix="건"
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Reorder Alerts Panel */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <Badge count={alerts.length} color="#ef4444" />
                <span>재주문 알림</span>
              </Space>
            }
            loading={loading}
          >
            {alerts.length === 0 ? (
              <Text type="secondary">현재 재주문 알림이 없습니다.</Text>
            ) : (
              <List
                dataSource={alerts}
                renderItem={(alert) => (
                  <List.Item
                    actions={[
                      <Button
                        key="ack"
                        size="small"
                        onClick={() => handleAcknowledge(alert.alert_id)}
                      >
                        확인
                      </Button>,
                      <Button
                        key="resolve"
                        size="small"
                        type="primary"
                        onClick={() => handleResolve(alert.alert_id)}
                      >
                        해결
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <WarningOutlined style={{ color: '#ef4444' }} />
                          <Text strong>{alert.item_name}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ({alert.item_code})
                          </Text>
                        </Space>
                      }
                      description={
                        <Space>
                          <Tag color="red">현재: {alert.current_quantity}</Tag>
                          <Tag color="blue">재주문 기준: {alert.reorder_point}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={10}>
          <Card title="최근 입출고 내역" loading={loading}>
            <List
              dataSource={recentActivity}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={item.type === 'inbound' ? 'green' : 'orange'}>
                          {item.type === 'inbound' ? '입고' : '출고'}
                        </Tag>
                        <Text>{item.item_name}</Text>
                      </Space>
                    }
                    description={
                      <Space>
                        <Text type="secondary">수량: {item.quantity}</Text>
                        <Text type="secondary">
                          {dayjs(item.created_at).format('MM/DD HH:mm')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '최근 거래 내역이 없습니다.' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
