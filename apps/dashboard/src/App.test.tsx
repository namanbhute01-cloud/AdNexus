import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AdNexus login shell', () => {
  render(<App />);
  expect(screen.getByText(/AdNexus/i)).toBeInTheDocument();
});
