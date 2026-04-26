type Props = {
  label: string;
  onConfirm: () => void;
  variant?: 'default' | 'danger';
};

export const CommandButton = ({ label, onConfirm, variant = 'default' }: Props) => {
  const onClick = () => {
    if (window.confirm(`Confirm command: ${label}?`)) {
      onConfirm();
    }
  };

  return (
    <button className={`btn ${variant === 'danger' ? 'btn-danger' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
};

