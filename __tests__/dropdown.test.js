import { describe, beforeEach, test, expect, jest } from '@jest/globals';

let menu;

describe('toggleActionsMenu positioning', () => {
  beforeEach(async () => {
    jest.resetModules();

    menu = {
      _classList: new Set(),
      classList: {
        contains: cls => menu._classList.has(cls),
        add: cls => menu._classList.add(cls),
        remove: cls => menu._classList.delete(cls)
      },
      style: {},
      getBoundingClientRect: jest.fn(() => ({ bottom: window.innerHeight + 10 }))
    };

    global.window = { innerHeight: 600 };
    global.document = {
      getElementById: jest.fn(() => menu),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn()
    };

    jest.unstable_mockModule('../ui.js', () => ({
      renderMovimientos: jest.fn(),
      renderHistorial: jest.fn(),
      showAlert: jest.fn(),
      displayTestResults: jest.fn(),
      hideTests: jest.fn()
    }));

    jest.unstable_mockModule('../utils/index.js', () => ({
      parseNum: jest.fn(() => 0),
      formatCurrency: jest.fn(v => v),
      formatDate: jest.fn(),
      getTodayString: jest.fn(() => '2025-01-01'),
      computeTotals: jest.fn(() => ({ diff: 0 }))
    }));

    await import('../app.js');
  });

  test('positions menu above when it would overflow', () => {
    window.toggleActionsMenu('test');
    expect(menu.style.bottom).toBe('100%');
    expect(menu.style.top).toBe('auto');
  });
});
