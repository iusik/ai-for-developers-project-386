import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { render } from './test/render';

describe('App', () => {
  it('показывает название сервиса в шапке', () => {
    render(<App />);

    expect(screen.getByText('Календарь звонков')).toBeInTheDocument();
  });

  it('переключает тему между светлой и тёмной', () => {
    render(<App />);
    const root = document.documentElement;

    expect(root).toHaveAttribute('data-mantine-color-scheme', 'light');

    fireEvent.click(
      screen.getByRole('button', { name: 'Включить тёмную тему' }),
    );
    expect(root).toHaveAttribute('data-mantine-color-scheme', 'dark');

    fireEvent.click(
      screen.getByRole('button', { name: 'Включить светлую тему' }),
    );
    expect(root).toHaveAttribute('data-mantine-color-scheme', 'light');
  });
});
