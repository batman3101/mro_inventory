import { useEffect, useState } from 'react';
import { Row, Col, Card, DatePicker, Typography, Space } from 'antd';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface DeptData { department_name: string; quantity: number }
interface MonthlyData { month: string; inbound: number; outbound: number }
interface SupplierData { supplier_name: string; value: number }
interface TopItemData { item_name: string; quantity: number }

const Analytics = () => {
  const { t } = useTranslation();
  const defaultStart = dayjs().subtract(3, 'month').startOf('day');
  const defaultEnd = dayjs().endOf('day');

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([defaultStart, defaultEnd]);
  const [deptData, setDeptData] = useState<DeptData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [supplierData, setSupplierData] = useState<SupplierData[]>([]);
  const [topItems, setTopItems] = useState<TopItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (start: Dayjs, end: Dayjs) => {
    setLoading(true);
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');

    try {
      const [
        { data: outboundRaw },
        { data: inboundRaw },
        { data: inboundMonthRaw },
        { data: outboundMonthRaw },
      ] = await Promise.all([
        supabase
          .from('outbound')
          .select('department_name, quantity, item_name')
          .gte('outbound_date', startDate)
          .lte('outbound_date', endDate),
        supabase
          .from('inbound')
          .select('supplier_name, total_price, inbound_date')
          .gte('inbound_date', startDate)
          .lte('inbound_date', endDate),
        supabase
          .from('inbound')
          .select('inbound_date, quantity')
          .gte('inbound_date', startDate)
          .lte('inbound_date', endDate),
        supabase
          .from('outbound')
          .select('outbound_date, quantity')
          .gte('outbound_date', startDate)
          .lte('outbound_date', endDate),
      ]);

      // Department consumption
      const deptMap = new Map<string, number>();
      for (const row of outboundRaw ?? []) {
        const name = row.department_name || t('common.unassigned');
        deptMap.set(name, (deptMap.get(name) ?? 0) + (row.quantity ?? 0));
      }
      setDeptData(
        Array.from(deptMap.entries())
          .map(([department_name, quantity]) => ({ department_name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
      );

      // Monthly trend (last 6 months within range)
      const monthMap = new Map<string, { inbound: number; outbound: number }>();
      const monthCount = Math.min(6, end.diff(start, 'month') + 1);
      for (let i = monthCount - 1; i >= 0; i--) {
        const m = end.subtract(i, 'month').format('YYYY-MM');
        monthMap.set(m, { inbound: 0, outbound: 0 });
      }
      for (const row of inboundMonthRaw ?? []) {
        const m = dayjs(row.inbound_date).format('YYYY-MM');
        if (monthMap.has(m)) {
          monthMap.get(m)!.inbound += row.quantity ?? 0;
        }
      }
      for (const row of outboundMonthRaw ?? []) {
        const m = dayjs(row.outbound_date).format('YYYY-MM');
        if (monthMap.has(m)) {
          monthMap.get(m)!.outbound += row.quantity ?? 0;
        }
      }
      setMonthlyData(
        Array.from(monthMap.entries()).map(([month, vals]) => ({ month, ...vals }))
      );

      // Supplier cost
      const supplierMap = new Map<string, number>();
      for (const row of inboundRaw ?? []) {
        const name = row.supplier_name || t('common.unassigned');
        supplierMap.set(name, (supplierMap.get(name) ?? 0) + (row.total_price ?? 0));
      }
      setSupplierData(
        Array.from(supplierMap.entries())
          .map(([supplier_name, value]) => ({ supplier_name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6)
      );

      // Top 10 items by outbound quantity
      const itemMap = new Map<string, number>();
      for (const row of outboundRaw ?? []) {
        const name = row.item_name || t('common.unassigned');
        itemMap.set(name, (itemMap.get(name) ?? 0) + (row.quantity ?? 0));
      }
      setTopItems(
        Array.from(itemMap.entries())
          .map(([item_name, quantity]) => ({ item_name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10)
      );
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(dateRange[0], dateRange[1]);
  }, []);

  const handleRangeChange = (values: [Dayjs | null, Dayjs | null] | null) => {
    if (values && values[0] && values[1]) {
      const range: [Dayjs, Dayjs] = [values[0], values[1]];
      setDateRange(range);
      fetchAnalytics(range[0], range[1]);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '24px', width: '100%', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          {t('analytics.title')}
        </Title>
        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          format="YYYY-MM-DD"
        />
      </Space>

      <Row gutter={[16, 16]}>
        {/* Chart 1: Department consumption */}
        <Col xs={24} lg={12}>
          <Card title={t('analytics.deptConsumption')} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department_name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend verticalAlign="top" />
                <Bar dataKey="quantity" name={t('analytics.outboundQty')} fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Chart 2: Monthly inbound/outbound trend */}
        <Col xs={24} lg={12}>
          <Card title={t('analytics.monthlyTrend')} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="inbound" name={t('menu.inbound')} stroke={COLORS[1]} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="outbound" name={t('menu.outbound')} stroke={COLORS[2]} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Chart 3: Supplier cost pie */}
        <Col xs={24} lg={12}>
          <Card title={t('analytics.supplierCost')} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={supplierData}
                  dataKey="value"
                  nameKey="supplier_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ supplier_name, percent }) =>
                    `${supplier_name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {supplierData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Chart 4: Top 10 items horizontal bar */}
        <Col xs={24} lg={12}>
          <Card title={`${t('analytics.topItems')} (Top 10)`} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topItems}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="item_name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="quantity" name={t('analytics.outboundQty')} fill={COLORS[4]}>
                  {topItems.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
