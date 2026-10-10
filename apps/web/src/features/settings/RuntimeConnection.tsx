'use client';

import type { ApiClient } from './service';
import { useRuntimeConnection } from './useRuntimeConnection';

export const RuntimeConnection = ({ api }: { api?: ApiClient }) => {
  const connection = useRuntimeConnection(api);
  const errorContent = connection.error ? <p className="RuntimeConnection__error text-sm" role="alert">{connection.error}</p> : null;
  const statusContent = connection.message ? <p className="RuntimeConnection__status text-sm" role="status">{connection.message}</p> : null;
  return (
    <section className="RuntimeConnection rounded-2xl border p-5 space-y-3" aria-labelledby="runtime-connection-title">
      <h3 className="RuntimeConnection__title font-semibold" id="runtime-connection-title">Connect runtime</h3>
      <p className="RuntimeConnection__description text-sm">Enter the browser bootstrap code from your runtime descriptor. After restarting the runtime, connect again before registering roots.</p>
      <form className="RuntimeConnection__form space-y-3" onSubmit={connection.connect}>
        <label className="RuntimeConnection__label block text-sm" htmlFor="bootstrap-code">Bootstrap code</label>
        <input className="RuntimeConnection__input w-full rounded-lg border px-3 py-2" id="bootstrap-code" type="password" value={connection.code} autoComplete="off" onChange={event => connection.setCode(event.target.value)} disabled={connection.pending} />
        <button className="RuntimeConnection__submit rounded-lg border px-4 py-2 disabled:opacity-50" type="submit" disabled={connection.disabled}>Connect runtime</button>
      </form>
      {errorContent}
      {statusContent}
    </section>
  );
};
