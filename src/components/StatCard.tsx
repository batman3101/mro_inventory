import type { ReactNode } from 'react';
import { Skeleton } from 'antd';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** A unit after the number. */
  suffix?: ReactNode;
  icon?: ReactNode;
  /** Colour only marks a state; a plain count stays in the text colour. */
  tone?: 'ok' | 'warn' | 'danger';
  loading?: boolean;
}

const StatCard = ({ label, value, suffix, icon, tone, loading }: StatCardProps) => (
  <div className={tone ? `stat ${tone}` : 'stat'}>
    <div className="k">{icon}{label}</div>
    {loading ? (
      <Skeleton.Button active size="small" />
    ) : (
      <div className="v">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix && <small>{suffix}</small>}
      </div>
    )}
  </div>
);

export default StatCard;
