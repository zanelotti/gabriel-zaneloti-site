import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Privacidade from './Privacidade';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Privacidade />
  </StrictMode>
);
