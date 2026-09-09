import { createRoot } from 'react-dom/client';
import { PublicTools } from './site/PublicTools';
import { localPreview } from './site/preview';
createRoot(document.getElementById('root')!).render(<>{localPreview && <aside className="local-preview-banner">Local preview · Sample traces, not verified evidence</aside>}<PublicTools /></>);
