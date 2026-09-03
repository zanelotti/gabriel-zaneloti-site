import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

/** Botão flutuante de WhatsApp, fixo no canto inferior direito em todas as telas. */
export function WhatsAppButton() {
  return (
    <a
      href={generateGenericWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('whatsapp_clicked', { origem: 'botao_flutuante' })}
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-card transition-transform duration-200 hover:scale-105 active:scale-95 sm:bottom-7 sm:right-7"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.29-1.38a9.87 9.87 0 004.7 1.2h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08 1-2.37.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.13-.28.27-.12.53.16.26.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.2 1.37.26.14.41.12.56-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.26.13.44.19.5.3.06.11.06.63-.18 1.31z" />
      </svg>
    </a>
  );
}
