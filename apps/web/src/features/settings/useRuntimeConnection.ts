'use client';

import { useState } from 'react';
import { SettingsService, type ApiClient } from './service';

export function useRuntimeConnection(api?: ApiClient) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const result = await new SettingsService(api).connect(code.trim());
      if (result.ok === false) {
        setError(result.error.message);
        return;
      }
      setCode('');
      setMessage('Runtime connected');
    } catch {
      setError('Could not connect to runtime');
    } finally {
      setPending(false);
    }
  };
  return { code, setCode, pending, message, error, connect, disabled: pending || !code.trim() };
}
