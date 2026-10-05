import { Portal } from './portal/Portal';
import { routeAfterEmailLink } from './lib/auth';
import { PrefsProvider, useRoute } from './lib/prefs';
import { Site } from './site/Site';

function Routes() {
  const route = useRoute();
  return route[0] === 'portal' ? <Portal route={route} /> : <Site />;
}

export default function App() {
  routeAfterEmailLink();
  const portal = typeof window !== 'undefined' && window.location.hash.startsWith('#/portal');
  return (
    <PrefsProvider defaultUi={portal ? 'ar' : undefined}>
      <Routes />
    </PrefsProvider>
  );
}
