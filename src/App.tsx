import { lazy } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/Hero';
import { Destaques } from '@/components/Destaques';
import { Dores } from '@/components/Dores';
import { Tranquilidade } from '@/components/Tranquilidade';
import { Numeros } from '@/components/Numeros';
import { ExemplosMetragem } from '@/components/ExemplosMetragem';
import { CarregarQuandoPerto } from '@/components/ui/CarregarQuandoPerto';
import { HowItWorks } from '@/components/HowItWorks';
import { Services } from '@/components/Services';
import { Authority } from '@/components/Authority';
import { About } from '@/components/About';
import { Benefits } from '@/components/Benefits';
import { Depoimentos } from '@/components/Depoimentos';
import { Agendamento } from '@/components/Agendamento';
import { GuiaCaminho } from '@/components/GuiaCaminho';
import { FAQ } from '@/components/FAQ';
import { CTA } from '@/components/CTA';
import { WhatsAppButton } from '@/components/WhatsAppButton';

// O mapa do Brasil carrega muitos dados e fica longe do topo: só é baixado quando o visitante chega perto dele.
const BrasilMapa = lazy(() => import('@/components/BrasilMapa').then((m) => ({ default: m.BrasilMapa })));

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Destaques />
        <Dores />
        <Numeros />
        <ExemplosMetragem />
        <CarregarQuandoPerto id="todo-brasil" alturaMinima="34rem">
          <BrasilMapa />
        </CarregarQuandoPerto>
        <HowItWorks />
        <Services />
        <Authority />
        <About />
        <Benefits />
        <Depoimentos />
        <Tranquilidade />
        <Agendamento />
        <GuiaCaminho />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

export default App;
