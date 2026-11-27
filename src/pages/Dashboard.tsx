import { useEffect, useState, type ReactNode } from 'react';
import { Card, Select, DatePicker, Typography, Space, Alert } from 'antd';
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
import { fetchAllRows } from '@/lib/fetchAll';
import { getLocationId, getOptionalLocationId } from '@/services/locationContext';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useChartTheme } from '@/components/chartTheme';
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

// Supabase reports query failures in the response instead of throwing; an
// unchecked error would otherwise be shown as a normal 0 / empty value.
function checked<R extends { error: { message: string } | null }>(res: R): R {
  if (res.error) throw new Error(res.error.message);
  return res;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const chart = useChartTheme();
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
  const [loadError, setLoadError] = useState(false);

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
    // Every figure is for the factory selected in the sidebar.
    const locationId = getLocationId();
    const [inventoryData, { count: lowStock }, { count: zeroStock }, { count: suppliers }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from('inventory')
          .select('inventory_id, current_quantity')
          .eq('location_id', locationId)
          .order('inventory_id')
          .range(from, to)
      ),
      supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .gt('current_quantity', 0)
        .lt('current_quantity', 10)
        .then(checked),
      supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('current_quantity', 0)
        .then(checked),
      supabase
        .from('suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('status', 'ACTIVE')
        .then(checked),
    ]);

    const totalStock = inventoryData.reduce(
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

  // Resolves a unit price per item: current managed price (item_prices.is_current)
  // first, then the most recent inbound unit price as fallback. Set-based to avoid
  // an N+1 query per outbound row.
  const resolveUnitPrices = async (itemIds: string[], locationId: string): Promise<Map<string, number>> => {
    const priceMap = new Map<string, number>();
    if (itemIds.length === 0) return priceMap;

    const { data: currentPrices } = checked(
      await supabase
        .from('item_prices')
        .select('item_id, unit_price')
        .eq('location_id', locationId)
        .in('item_id', itemIds)
        .eq('is_current', true)
    );

    for (const row of currentPrices ?? []) {
      priceMap.set(row.item_id, Number(row.unit_price ?? 0));
    }

    const missing = itemIds.filter((id) => !priceMap.has(id));
    if (missing.length > 0) {
      const inboundPrices = await fetchAllRows((from, to) =>
        supabase
          .from('inbound')
          .select('inbound_id, item_id, unit_price, inbound_date')
          .eq('location_id', locationId)
          .in('item_id', missing)
          .order('inbound_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('inbound_id')
          .range(from, to)
      );

      // Rows are newest-first, so the first hit per item is its latest price.
      for (const row of inboundPrices) {
        if (!priceMap.has(row.item_id)) {
          priceMap.set(row.item_id, Number(row.unit_price ?? 0));
        }
      }
    }

    return priceMap;
  };

  const fetchChartData = async () => {
    const [startDate, endDate] = getDateRange();
    const locationId = getLocationId();

    const [inboundRaw, outboundRaw] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from('inbound')
          .select('inbound_id, inbound_date, total_price')
          .eq('location_id', locationId)
          .gte('inbound_date', startDate)
          .lte('inbound_date', endDate)
          .order('inbound_id')
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase
          .from('outbound')
          .select('outbound_id, outbound_date, item_id, quantity')
          .eq('location_id', locationId)
          .gte('outbound_date', startDate)
          .lte('outbound_date', endDate)
          .order('outbound_id')
          .range(from, to)
      ),
    ]);

    const dateMap = new Map<string, { inbound: number; outbound: number }>();
    let cursor = dayjs(startDate);
    const endDay = dayjs(endDate);
    while (cursor.isBefore(endDay) || cursor.isSame(endDay, 'day')) {
      dateMap.set(cursor.format('MM/DD'), { inbound: 0, outbound: 0 });
      cursor = cursor.add(1, 'day');
    }

    for (const row of inboundRaw) {
      const key = dayjs(row.inbound_date).format('MM/DD');
      if (dateMap.has(key)) {
        dateMap.get(key)!.inbound += Number(row.total_price ?? 0);
      }
    }

    // outbound stores no amount — value each issued line at its item's unit price.
    const outboundItemIds = [...new Set(outboundRaw.map((r) => r.item_id))];
    const unitPriceMap = await resolveUnitPrices(outboundItemIds, locationId);

    for (const row of outboundRaw) {
      const key = dayjs(row.outbound_date).format('MM/DD');
      if (dateMap.has(key)) {
        const unitPrice = unitPriceMap.get(row.item_id) ?? 0;
        dateMap.get(key)!.outbound += Number(row.quantity ?? 0) * unitPrice;
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
    const locationId = getLocationId();
    const [{ data: inbound }, { data: outbound }] = await Promise.all([
      supabase
        .from('inbound')
        .select('quantity, created_at, items(item_code, item_name, unit)')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(checked),
      supabase
        .from('outbound')
        .select('quantity, created_at, items(item_code, item_name, unit)')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(checked),
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
      // MainLayout picks the factory right after login and remounts this page;
      // until then there is nothing to show (and no global fallback query).
      if (!getOptionalLocationId()) return;
      setLoading(true);
      setLoadError(false);
      try {
        await Promise.all([fetchStats(), fetchChartData(), fetchRecentRecords()]);
      } catch (error) {
        console.error(t('dashboard.fetchError'), error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (!getOptionalLocationId()) return;
    fetchChartData().catch((error) => {
      console.error(t('dashboard.fetchError'), error);
      setLoadError(true);
    });
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

  const recentList = (records: RecentRecord[], icon: ReactNode, emptyText: string) =>
    records.length === 0 ? (
      <Typography.Text type="secondary">{emptyText}</Typography.Text>
    ) : (
      <div className="lines">
        {records.map((record, idx) => (
          <div key={idx} className="li">
            {icon}
            <div className="what">
              <b>{record.item_code} - {record.item_name}</b>{' '}
              <span className="sub">({record.quantity} {record.item_unit})</span>
            </div>
            <span className="when">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</span>
          </div>
        ))}
      </div>
    );

  return (
    <div>
      <PageHeader title={t('dashboard.title')} />

      {loadError && (
        <Alert type="error" showIcon message={t('dashboard.loadFailed')} className="page-gap" />
      )}

      {/* Summary: colour only where the number is a warning */}
      <div className="stats">
        <StatCard
          loading={loading}
          label={t('dashboard.totalStock')}
          value={stats.totalStock}
          icon={<InboxOutlined />}
          suffix={t('dashboard.unitSuffix')}
        />
        <StatCard
          loading={loading}
          label={t('dashboard.lowStock')}
          value={stats.lowStockCount}
          icon={<WarningOutlined />}
          tone={stats.lowStockCount > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          loading={loading}
          label={t('dashboard.zeroStock')}
          value={stats.zeroStockCount}
          icon={<CloseCircleOutlined />}
          tone={stats.zeroStockCount > 0 ? 'danger' : 'ok'}
        />
        <StatCard
          loading={loading}
          label={t('dashboard.totalSuppliers')}
          value={stats.totalSuppliers}
          icon={<TeamOutlined />}
        />
      </div>

      {/* Chart */}
      <Card
        loading={loading}
        title={`${getPeriodLabel()} ${t('dashboard.chartTitle')}`}
        extra={
          <Space>
            <Select
              value={period}
              onChange={(val) => setPeriod(val)}
              className="w-select"
            >
              <Select.Option value="7days">{t('dashboard.period7days')}</Select.Option>
              <Select.Option value="1month">{t('dashboard.period1month')}</Select.Option>
              <Select.Option value="custom">{t('dashboard.periodCustom')}</Select.Option>
            </Select>
            {period === 'custom' && (
              <RangePicker
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setCustomRange([dates[0], dates[1]]);
                  }
                }}
              />
            )}
          </Space>
        }
        className="page-gap"
      >
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid {...chart.grid} />
            <XAxis dataKey="date" {...chart.axis} />
            <YAxis tickFormatter={formatYAxis} {...chart.axis} />
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₫`} {...chart.tooltip} />
            <Legend formatter={(value) => <span style={chart.legendText}>{value}</span>} />
            <Line
              type="monotone"
              dataKey="inbound"
              name={t('dashboard.inboundAmount')}
              stroke={chart.inbound}
              strokeWidth={2}
              dot={{ r: 4, fill: chart.inbound }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="outbound"
              name={t('dashboard.outboundAmount')}
              stroke={chart.outbound}
              strokeWidth={2}
              dot={{ r: 4, fill: chart.outbound }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Inbound / Outbound */}
      <div className="grid-2">
        <Card title={t('dashboard.recentInbound')} loading={loading}>
          {recentList(recentInbound, <ArrowUpOutlined />, t('dashboard.noRecentInbound'))}
        </Card>
        <Card title={t('dashboard.recentOutbound')} loading={loading}>
          {recentList(recentOutbound, <ArrowDownOutlined />, t('dashboard.noRecentOutbound'))}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
