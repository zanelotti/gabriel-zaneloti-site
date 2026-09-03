import { useState, type FormEvent, type PropsWithChildren } from 'react';

const SESSION_KEY = 'gz_calculo_unlocked';

/**
 * Barreira simples baseada em senha fixa (variável de ambiente VITE_CALCULO_PASSCODE).
 *
 * ATENÇÃO: isto NÃO é segurança de verdade — a senha fica embutida no código
 * que roda no navegador de qualquer pessoa que abrir a página, então alguém
 * com conhecimento técnico pode encontrá-la. É só um filtro para evitar que a
 * página seja encontrada por acidente (ela já não é linkada em lugar nenhum
 * do site nem indexada por buscadores).
 *
 * Para proteção de verdade, use a Proteção por Senha do próprio Vercel
 * (Project Settings → Deployment Protection) — disponível nos planos pagos.
 *
 * Se VITE_CALCULO_PASSCODE não estiver definida, a página fica aberta.
 */
export function PasscodeGate({ children }: PropsWithChildren) {
  const configuredPasscode = import.meta.env.VITE_CALCULO_PASSCODE as string | undefined;

  const [unlocked, setUnlocked] = useState(
    () => !configuredPasscode || sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [attempt, setAttempt] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (attempt === configuredPasscode) {
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl2 bg-white p-8 shadow-card">
        <h1 className="text-lg font-bold text-navy-900">Área interna</h1>
        <p className="mt-1 text-sm text-navy-500">Digite a senha para acessar a calculadora.</p>
        <input
          type="password"
          autoFocus
          className={`field-input mt-4 ${error ? 'field-input-error' : ''}`}
          value={attempt}
          onChange={(event) => {
            setAttempt(event.target.value);
            setError(false);
          }}
        />
        {error && <p className="field-error">Senha incorreta.</p>}
        <button type="submit" className="btn-primary mt-4 w-full">
          Entrar
        </button>
      </form>
    </div>
  );
}
