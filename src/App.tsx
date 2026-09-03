import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/Hero';
import { Calculator } from '@/components/calculator/Calculator';
import { HowItWorks } from '@/components/HowItWorks';
import { Services } from '@/components/Services';
import { Authority } from '@/components/Authority';
import { About } from '@/components/About';
import { Benefits } from '@/components/Benefits';
import { FAQ } from '@/components/FAQ';
import { CTA } from '@/components/CTA';
import { WhatsAppButton } from '@/components/WhatsAppButton';

function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Calculator />
        <HowItWorks />
        <Services />
        <Authority />
        <About />
        <Benefits />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

export default App;
