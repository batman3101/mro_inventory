import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Select, DatePicker, Typography, Space } from 'antd';
import {
  InboxOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

type PeriodType = '7days' | '1month' | 'custom';

interface ChartDataPoint {
  date: string;
  inbound: number;
  outbound: number;
}

interface RecentRecord {
  item_code: string;
  item_name: string;
  quantity: number;
  item_unit: string;
  created_at: string;
}

interface SummaryStats {
  totalStock: number;
  lowStockCount: number;
  zeroStockCount: number;
  totalSuppliers: number;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SummaryStats>({
    totalStock: 0,
    lowStockCount: 0,
    zeroStockCount: 0,
    totalSuppliers: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [recentInbound, setRecentInbound] = useState<RecentRecord[]>([]);
  const [recentOutbound, setRecentOutbound] = useState<RecentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('7days');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  const getDateRange = (): [string, string] => {
    const end = dayjs().format('YYYY-MM-DD');
    if (period === '1month') {
      return [dayjs().subtract(1, 'month').format('YYYY-MM-DD'), end];
    }
    if (period === 'custom' && customRange) {
      return [customRange[0].format('YYYY-MM-DD'), customRange[1].format('YYYY-MM-DD')];
    }
    return [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), end];
  };

  const fetchStats = async () => {
    const [
      { data: inventoryData },
      { count: lowStock },
      { count: zeroStock },
      { count: suppliers },
    ] = await Promise.all([
      supabase.from('inventory').select('current_quantity'),
      supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .gt('current_quantity', 0)
        .lt('current_quantity', 10),
      supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('current_quantity', 0),
      supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
    ]);

    const totalStock = (inventoryData ?? []).reduce(
      (sum, row) => sum + (row.current_quantity ?? 0),
      0
    );

    setStats({
      totalStock,
      lowStockCount: lowStock ?? 0,
      zeroStockCount: zeroStock ?? 0,
      totalSuppliers: suppliers ?? 0,
    });
  };

  const fetchChartData = async () => {
    const [startDate, endDate] = getDateRange();

    const [{ data: inboundRaw }, { data: outboundRaw }] = await Promise.all([
      supabase
        .from('inbound')
        .select('inbound_date, total_price')
        .gte('inbound_date', startDate)
        .lte('inbound_date', endDate),
      supabase
        .from('outbound')
        .select('outbound_date, quantity')
        .gte('outbound_date', startDate)
        .lte('outbound_date', endDate),
    ]);

    const dateMap = new Map<string, { inbound: number; outbound: number }>();
    let cursor = dayjs(startDate);
    const endDay = dayjs(endDate);
    while (cursor.isBefore(endDay) || cursor.isSame(endDay, 'day')) {
      dateMap.set(cursor.format('MM/DD'), { inbound: 0, outbound: 0 });
      cursor = cursor.add(1, 'day');
    }

    for (const row of inboundRaw ?? []) {
      const key = dayjs(row.inbound_date).format('MM/DD');
      if (dateMap.has(key)) {
        dateMap.get(key)!.inbound += Number(row.total_price ?? 0);
      }
    }

    for (const row of outboundRaw ?? []) {
      const key = dayjs(row.outbound_date).format('MM/DD');
      if (dateMap.has(key)) {
        dateMap.get(key)!.outbound += Number(row.quantity ?? 0);
      }
    }

    setChartData(
      Array.from(dateMap.entries()).map(([date, vals]) => ({
        date,
        inbound: vals.inbound,
        outbound: vals.outbound,
      }))
    );
  };

  const fetchRecentRecords = async () => {
    // item_code/item_name/item_unit are NOT real columns on inbound/outbound —
    // they live on items and must be joined via the item_id FK.
    type RecentRow = {
      quantity: number | null;
      created_at: string | null;
      items: { item_code: string; item_name: string; unit: string } | null;
    };
    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase
        .from('inbound')
        .select('quantity, created_at, items(item_code, item_name, unit)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('outbound')
        .select('quantity, created_at, items(item_code, item_name, unit)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const project = (rows: unknown) => ((rows ?? []) as RecentRow[]).map((r) => ({
      item_code: r.items?.item_code ?? '',
      item_name: r.items?.item_name ?? '',
      quantity: r.quantity ?? 0,
      item_unit: r.items?.unit ?? 'EA',
      created_at: r.created_at ?? '',
    }));

    setRecentInbound(project(inbound));
    setRecentOutbound(project(outbound));
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStats(), fetchChartData(), fetchRecentRecords()]);
      } catch (error) {
        console.error(t('dashboard.fetchError'), error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [period, customRange]);

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ₫`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ₫`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K ₫`;
    return `${value} ₫`;
  };

  const getPeriodLabel = () => {
    if (period === '7days') return t('dashboard.period7days');
    if (period === '1month') return t('dashboard.period1month');
    return t('dashboard.periodCustom');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Typography.Title level={3} style={{ marginBottom: '24px' }}>
        {t('dashboard.title')}
      </Typography.Title>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.totalStock')}
              value={stats.totalStock}
              prefix={<InboxOutlined />}
              suffix={t('dashboard.unitSuffix')}
              valueStyle={{ color: '#2563eb' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.lowStock')}
              value={stats.lowStockCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.lowStockCount > 0 ? '#f59e0b' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.zeroStock')}
              value={stats.zeroStockCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: stats.zeroStockCount > 0 ? '#ef4444' : '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title={t('dashboard.totalSuppliers')}
              value={stats.totalSuppliers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      <Card
        loading={loading}
        title={`${getPeriodLabel()} ${t('dashboard.chartTitle')}`}
        extra={
          <Space>
            <Select
              value={period}
              onChange={(val) => setPeriod(val)}
              style={{ width: 160 }}
            >
              <Select.Option value="7days">{t('dashboard.period7days')}</Select.Option>
              <Select.Option value="1month">{t('dashboard.period1month')}</Select.Option>
              <Select.Option value="custom">{t('dashboard.periodCustom')}</Select.Option>
            </Select>
            {period === 'custom' && (
              <RangePicker
                size="small"
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setCustomRange([dates[0], dates[1]]);
                  }
                }}
              />
            )}
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₫`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="inbound"
              name={t('dashboard.inboundAmount')}
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 5, fill: '#22c55e' }}
              activeDot={{ r: 7 }}
            />
            <Line
              type="monotone"
              dataKey="outbound"
              name={t('dashboard.outboundAmount')}
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 5, fill: '#ef4444' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Inbound / Outbound */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('dashboard.recentInbound')} loading={loading}>
            {recentInbound.length === 0 ? (
              <Typography.Text type="secondary">{t('dashboard.noRecentInbound')}</Typography.Text>
            ) : (
              recentInbound.map((record, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: idx < recentInbound.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <ArrowUpOutlined style={{ color: '#22c55e', fontSize: 16, marginRight: 12 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>
                      {record.item_code} - {record.item_name}
                    </span>
                    <span style={{ marginLeft: 8, color: '#666' }}>
                      ({record.quantity} {record.item_unit})
                    </span>
                  </div>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    ({dayjs(record.created_at).format('YYYY-MM-DD HH:mm')})
                  </span>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('dashboard.recentOutbound')} loading={loading}>
            {recentOutbound.length === 0 ? (
              <Typography.Text type="secondary">{t('dashboard.noRecentOutbound')}</Typography.Text>
            ) : (
              recentOutbound.map((record, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: idx < recentOutbound.length - 1 ? '1px solid #f0f0f0' : 'none',
                  }}
                >
                  <ArrowDownOutlined style={{ color: '#ef4444', fontSize: 16, marginRight: 12 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>
                      {record.item_code} - {record.item_name}
                    </span>
                    <span style={{ marginLeft: 8, color: '#666' }}>
                      ({record.quantity} {record.item_unit})
                    </span>
                  </div>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    ({dayjs(record.created_at).format('YYYY-MM-DD HH:mm')})
                  </span>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
