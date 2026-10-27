import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import Parceiros from './Parceiros';
import { initAnalytics } from '../services/analytics';
import { trackPageView } from '../services/pageViewTracker';
import '../index.css';

initAnalytics();
trackPageView();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Parceiros />
    <Analytics />
  </StrictMode>
);
