'use client';

import React from 'react';
import { Shell } from '../src/features/shell/Shell';
import { RegistrationView } from '../src/features/settings/RegistrationView';
import { createApiClient } from '../src/lib/api/client';

export default function Home() {
  const api = React.useMemo(() => createApiClient({ baseUrl: '/api/v1' }), []);

  return (
    <Shell>
      <RegistrationView api={api} />
    </Shell>
  );
}
