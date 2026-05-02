import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { api } from '../../lib/api';
import { Eye, EyeOff, X } from 'lucide-react';
import { AxiosError } from 'axios';

interface Screen {
  id: string;
  deviceId: string;
  subSerial: string;
  position: string;
  createdAt: string;
  passwordHash?: string;
}

const PasswordCell = ({ screen }: { screen: Screen }) => {
  const queryClient = useQueryClient();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (newPassword: string) => {
      setError(null);
      await api.patch(`/screens/${screen.id}/reset-password`, { password: newPassword });
    },
    onSuccess: () => {
      setShowPasswordInput(false);
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['screens'] });
    },
    onError: (err: AxiosError<{ message: string }>) => {
      setError(err.response?.data?.message || 'Failed to reset password.');
    },
  });

  const handleResetPassword = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    mutation.mutate(password);
  };

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => setShowPasswordInput(!showPasswordInput)}
        className="text-accent hover:text-accent/80"
      >
        {showPasswordInput ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      {showPasswordInput && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="input input-bordered input-sm w-32"
          />
          <button onClick={handleResetPassword} className="btn btn-primary btn-sm">Set</button>
          {error && <span className="text-red-500 text-sm">{error}</span>}
        </div>
      )}
    </div>
  );
};

const screensColumns: ColumnDef<Screen>[] = [
  { header: 'ID', accessorKey: 'id' },
  { header: 'Device ID', accessorKey: 'deviceId' },
  { header: 'Sub Serial', accessorKey: 'subSerial' },
  { header: 'Position', accessorKey: 'position' },
  { header: 'Created At', accessorKey: 'createdAt' },
  {
    header: 'Actions',
    id: 'actions',
    cell: ({ row }) => <PasswordCell screen={row.original} />,
  },
];

export function ScreensPage() {
  const { data: screens, isLoading, error } = useQuery<Screen[], AxiosError>({
    queryKey: ['screens'],
    queryFn: async () => {
      const response = await api.get('/devices/all/screens');
      return response.data;
    },
  });

  const table = useReactTable({
    data: screens ?? [],
    columns: screensColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Screens Management</h1>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="bg-surface border-b border-border">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-elevated">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="border-b border-border">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
