import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('показывает заголовок сервиса', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Календарь звонков' }),
    ).toBeInTheDocument();
  });
});
