import { ReactNode } from 'react';

type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
};

export const DataTable = <T,>({ rows, columns }: Props<T>) => {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => (
              <td key={col.key}>{col.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

