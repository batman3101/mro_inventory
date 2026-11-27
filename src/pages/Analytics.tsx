import { useEffect, useState } from 'react';
import { Card, DatePicker, message } from 'antd';
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
import { getOptionalLocationId } from '@/services/locationContext';
import { fetchAllRows } from '@/lib/fetchAll';
import PageHeader from '@/components/PageHeader';
import { useChartTheme } from '@/components/chartTheme';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

// A long supplier name would run past the chart's edge, so a pie label is cut to
// the room it has (the tooltip shows the whole name). Widths are estimates at the
// label's 12px size: a Korean letter is about twice as wide as a Latin one.
const labelWidth = (text: string) =>
  [...text].reduce((width, ch) => width + (ch.charCodeAt(0) > 0x2e7f ? 12 : 6.8), 0);
const fitLabel = (name: string, suffix: string, room: number) => {
  if (labelWidth(`${name} ${suffix}`) <= room) return `${name} ${suffix}`;
  let short = name;
  while (short.length > 1 && labelWidth(`${short}… ${suffix}`) > room) short = short.slice(0, -1);
  return `${short}… ${suffix}`;
};

interface DeptData { department_name: string; quantity: number }
interface MonthlyData { month: string; inbound: number; outbound: number }
interface SupplierData { supplier_name: string; value: number }
interface TopItemData { item_name: string; quantity: number }

const Analytics = () => {
  const { t } = useTranslation();
  const chart = useChartTheme();
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
    const locationId = getOptionalLocationId();

    try {
      // department_name / item_name / supplier_name are NOT columns on the base
      // tables — they live on departments/items/suppliers and must be embedded
      // via PostgREST joins, mirroring outbound/inbound.service.ts.
      // Page through: a date range can exceed the 1,000-row response cap.
      const [outboundRows, inboundRows] = await Promise.all([
        fetchAllRows<any>((from, to) => {
          let query = supabase
            .from('outbound')
            .select('outbound_id, quantity, outbound_date, items(item_name), departments(department_name)')
            .gte('outbound_date', startDate)
            .lte('outbound_date', endDate);
          if (locationId) query = query.eq('location_id', locationId);
          return query.order('outbound_id').range(from, to);
        }),
        fetchAllRows<any>((from, to) => {
          let query = supabase
            .from('inbound')
            .select('inbound_id, quantity, total_price, inbound_date, suppliers(supplier_name)')
            .gte('inbound_date', startDate)
            .lte('inbound_date', endDate);
          if (locationId) query = query.eq('location_id', locationId);
          return query.order('inbound_id').range(from, to);
        }),
      ]);

      // Department consumption
      const deptMap = new Map<string, number>();
      for (const row of outboundRows) {
        const name = row.departments?.department_name || t('common.unassigned');
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
      for (const row of inboundRows) {
        const m = dayjs(row.inbound_date).format('YYYY-MM');
        if (monthMap.has(m)) {
          monthMap.get(m)!.inbound += row.quantity ?? 0;
        }
      }
      for (const row of outboundRows) {
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
      for (const row of inboundRows) {
        const name = row.suppliers?.supplier_name || t('common.unassigned');
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
      for (const row of outboundRows) {
        const name = row.items?.item_name || t('common.unassigned');
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
      message.error(t('common.error'));
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

  const legendText = (value: string) => <span style={chart.legendText}>{value}</span>;

  return (
    <div>
      <PageHeader title={t('analytics.title')}>
        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          format="YYYY-MM-DD"
        />
      </PageHeader>

      <div className="grid-2">
        {/* Chart 1: Department consumption */}
        <Card title={t('analytics.deptConsumption')} loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid {...chart.grid} />
              <XAxis dataKey="department_name" angle={-30} textAnchor="end" interval={0} {...chart.axis} />
              <YAxis {...chart.axis} />
              <Tooltip {...chart.tooltip} />
              <Legend verticalAlign="top" formatter={legendText} />
              <Bar dataKey="quantity" name={t('analytics.outboundQty')} fill={chart.series[0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 2: Monthly inbound/outbound trend */}
        <Card title={t('analytics.monthlyTrend')} loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid {...chart.grid} />
              <XAxis dataKey="month" {...chart.axis} />
              <YAxis {...chart.axis} />
              <Tooltip {...chart.tooltip} />
              <Legend formatter={legendText} />
              <Line type="monotone" dataKey="inbound" name={t('menu.inbound')} stroke={chart.inbound} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="outbound" name={t('menu.outbound')} stroke={chart.outbound} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 3: Supplier cost pie */}
        <Card title={t('analytics.supplierCost')} loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={supplierData}
                dataKey="value"
                nameKey="supplier_name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                stroke={chart.surface}
                strokeWidth={2}
                label={({ supplier_name, percent, x, y, cx, textAnchor }) => (
                  <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" {...chart.label}>
                    <title>{supplier_name}</title>
                    {fitLabel(
                      String(supplier_name),
                      `${((percent ?? 0) * 100).toFixed(0)}%`,
                      (textAnchor === 'end' ? Number(x) : Number(cx) * 2 - Number(x)) - 4,
                    )}
                  </text>
                )}
              >
                {supplierData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={chart.series[index % chart.series.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} ₫`} {...chart.tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 4: Top 10 items horizontal bar */}
        <Card title={`${t('analytics.topItems')} (Top 10)`} loading={loading}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topItems}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 8, bottom: 5 }}
            >
              <CartesianGrid {...chart.grid} />
              <XAxis type="number" {...chart.axis} />
              <YAxis dataKey="item_name" type="category" width={150} interval={0} {...chart.axis} />
              <Tooltip {...chart.tooltip} />
              <Bar dataKey="quantity" name={t('analytics.outboundQty')} fill={chart.series[0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
