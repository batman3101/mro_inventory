import { useState, useMemo } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';

import 'react-resizable/css/styles.css';

interface ResizableTitleProps extends React.HTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
}

const ResizableTitle = ({ onResize, width, ...restProps }: ResizableTitleProps) => {
  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            zIndex: 1,
            width: 10,
            height: '100%',
            cursor: 'col-resize',
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ ...restProps.style, position: 'relative' }} />
    </Resizable>
  );
};

type ResizableTableProps<T> = Omit<TableProps<T>, 'columns' | 'components'> & {
  columns: ColumnsType<T>;
};

function columnKey<T>(col: ColumnType<T>, index: number): string {
  return String(col.key ?? col.dataIndex ?? index);
}

export function ResizableTable<T extends object>({
  columns: initialColumns,
  ...rest
}: ResizableTableProps<T>) {
  const [widthOverrides, setWidthOverrides] = useState<Record<string, number>>({});

  const handleResize =
    (key: string) =>
    (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
      setWidthOverrides((prev) => ({ ...prev, [key]: size.width }));
    };

  const mergedColumns: ColumnsType<T> = useMemo(
    () =>
      initialColumns.map((col, index) => {
        const typed = col as ColumnType<T>;
        const key = columnKey(typed, index);
        const effectiveWidth =
          widthOverrides[key] ?? (typed.width as number | undefined);
        return {
          ...col,
          width: effectiveWidth,
          onHeaderCell: () =>
            ({
              width: effectiveWidth,
              onResize: handleResize(key),
            }) as React.HTMLAttributes<HTMLElement>,
        };
      }),
    [initialColumns, widthOverrides]
  );

  return (
    <Table<T>
      {...rest}
      columns={mergedColumns}
      components={{ header: { cell: ResizableTitle } }}
    />
  );
}

export default ResizableTable;
