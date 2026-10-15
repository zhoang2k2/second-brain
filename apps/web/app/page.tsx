'use client';

import React, { useState } from 'react';
import { Shell } from '../src/features/shell/Shell';
import { RegistrationView } from '../src/features/settings/RegistrationView';
import { KnowledgeView } from '../src/features/knowledge/KnowledgeView';
import { createApiClient } from '../src/lib/api/client';
import { ViewType } from '../src/features/shell/view-model';

export default function Home() {
  const api = React.useMemo(() => createApiClient({ baseUrl: '/api/v1' }), []);
  const [activeView, setActiveView] = useState<ViewType>('settings');

  return (
    <Shell activeView={activeView} onViewChange={setActiveView}>
      {activeView === 'knowledge' ? (
        <KnowledgeView api={api} scope={{ kind: 'global' }} />
      ) : (
        <RegistrationView api={api} />
      )}
    </Shell>
  );
}
