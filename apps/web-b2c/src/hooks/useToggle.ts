import { useState, useCallback } from 'react';

/**
 * Simple hook for boolean toggle state
 * Reduces repetitive useState patterns across components
 */
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  
  return [value, toggle, setTrue, setFalse] as const;
};