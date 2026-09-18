import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/services/supabaseClient';
import { crmAuth } from '@/services/crmService';
import { LoginScreen } from './LoginScreen';
import { MainShell } from './MainShell';

/**
 * Ponto de entrada do CRM interno. Resolve 3 estados possíveis:
 * 1. Supabase não configurado (faltam as variáveis VITE_SUPABASE_*)
 * 2. Não logado -> mostra tela de login
 * 3. Logado -> mostra o CRM (quadro + dashboard)
 */
export function CrmApp() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChecking(false);
      return;
    }

    let active = true;

    crmAuth
      .getSession()
      .then((session) => {
        if (!active) return;
        setLoggedIn(Boolean(session));
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setChecking(false);
      });

    const unsubscribe = crmAuth.onAuthStateChange((isLoggedIn) => {
      setLoggedIn(isLoggedIn);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-5">
        <div className="w-full max-w-md rounded-xl2 bg-white p-8 text-center shadow-card">
          <h1 className="text-lg font-bold text-navy-900">CRM não configurado</h1>
          <p className="mt-2 text-sm text-navy-500">
            Faltam as variáveis <code className="rounded bg-navy-50 px-1.5 py-0.5">VITE_SUPABASE_URL</code> e{' '}
            <code className="rounded bg-navy-50 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> no ambiente do site.
          </p>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <p className="text-sm font-medium text-navy-300">Carregando…</p>
      </div>
    );
  }

  return loggedIn ? <MainShell /> : <LoginScreen />;
}
