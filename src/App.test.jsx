import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock('./openai', () => ({
  getPostSessionDebrief: vi.fn(),
  getLiveCoachMessage: vi.fn(),
  getCalendarAdjustment: vi.fn(),
  getNutritionAdvice: vi.fn(),
  getChatCoachReply: vi.fn(),
}));

test('renders without crashing', () => {
  render(<App />);
  expect(document.body).toBeTruthy();
});
