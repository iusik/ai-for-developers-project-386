import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';
import { render } from './test/render';

describe('HomePage', () => {
  it('показывает владельца', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Usik Ivan' }),
    ).toBeInTheDocument();
  });

  it('ведёт кнопкой «Записаться» на страницу бронирования', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute(
      'href',
      '/book',
    );
  });

  it('перечисляет возможности сервиса', () => {
    render(<HomePage />);

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual([
      'Выбор типа звонка',
      'Свободное время в вашем поясе',
      'Без регистрации',
      'Мгновенное подтверждение',
    ]);
  });
});
