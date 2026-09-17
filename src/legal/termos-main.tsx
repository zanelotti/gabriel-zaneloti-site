import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Termos from './Termos';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Termos />
  </StrictMode>
);
