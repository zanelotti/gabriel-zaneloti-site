import { useState, type FormEvent } from 'react';
import { crmAuth } from '@/services/crmService';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await crmAuth.signIn(email, password);
    } catch {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-card">
        <h1 className="text-lg font-bold text-navy-900">CRM — Gabriel Zaneloti</h1>
        <p className="mt-1 text-sm text-navy-500">Entre com seu e-mail e senha.</p>

        <label className="field-label mt-5">E-mail</label>
        <input
          type="email"
          autoFocus
          required
          className="field-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="field-label mt-4">Senha</label>
        <input
          type="password"
          required
          className="field-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="field-error">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
