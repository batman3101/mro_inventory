import { useMemo } from 'react';
import { useResolvedTheme } from '@/store/theme.store';
import { fontFamily, palettes } from '@/styles/tokens';

// Colours and common props for the recharts charts, from tokens.ts, so a chart
// follows the light/dark theme like the rest of the screen.
export function useChartTheme() {
  const themeName = useResolvedTheme();
  return useMemo(() => {
    const c = palettes[themeName];
    return {
      /** Series colours in order. Past the four chart colours come two greys (a pie can have six slices);
       *  both keep 3:1 against the surface (the border grey line2 did not: 1.55:1). */
      series: [c.viz1, c.viz2, c.viz3, c.viz4, c.ink3, c.lineInput],
      inbound: c.viz1,
      outbound: c.viz2,
      /** The edge between pie slices. */
      surface: c.surface,
      grid: { stroke: c.vizGrid, strokeDasharray: '3 3' },
      axis: {
        stroke: c.vizAxis,
        tick: { fill: c.ink2, fontSize: 11, fontFamily },
        tickLine: { stroke: c.vizAxis },
      },
      tooltip: {
        contentStyle: { background: c.surface, border: `1px solid ${c.line}`, color: c.ink },
        labelStyle: { color: c.ink2 },
        itemStyle: { color: c.ink },
        cursor: { stroke: c.vizAxis, fill: c.hover },
      },
      /** The legend's words stay in the text colour; only the marker carries the series colour. */
      legendText: { color: c.ink2 },
      label: { fill: c.ink, fontSize: 12 },
    };
  }, [themeName]);
}
