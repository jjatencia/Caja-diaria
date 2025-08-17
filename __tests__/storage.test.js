import { describe, beforeEach, test, expect } from '@jest/globals';
import { saveDayData, loadDay, getDayIndex, deleteDay } from '../storage.js';

let store = {};

beforeEach(() => {
  store = {};
  global.localStorage = {
    setItem: (k, v) => { store[k] = v; },
    getItem: (k) => store[k] || null,
    removeItem: (k) => { delete store[k]; }
  };
});

describe('saveDayData with multiple closings per day', () => {
  test('creates unique keys for same date', () => {
    const key1 = saveDayData('2024-01-01', { cierre: 100 });
    const key2 = saveDayData('2024-01-01', { cierre: 200 });
    expect(key1).not.toBe(key2);
    expect(getDayIndex()).toHaveLength(2);
    expect(loadDay(key1).cierre).toBe(100);
    expect(loadDay(key2).cierre).toBe(200);
  });

  test('allows updating existing key', () => {
    const key1 = saveDayData('2024-01-01', { cierre: 100 });
    const keyUpdated = saveDayData('2024-01-01', { cierre: 150 }, key1);
    expect(keyUpdated).toBe(key1);
    expect(getDayIndex()).toHaveLength(1);
    expect(loadDay(key1).cierre).toBe(150);
  });

  test('deleteDay removes entry and index', () => {
    const key = saveDayData('2024-01-01', { cierre: 100 });
    deleteDay(key);
    expect(getDayIndex()).toHaveLength(0);
    expect(loadDay(key)).toBeNull();
  });
});

