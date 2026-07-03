import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Segments } from "@/components/landing/Segments";
import { DemoExamples } from "@/components/landing/DemoExamples";
import { Pricing } from "@/components/landing/Pricing";
import { Safety } from "@/components/landing/Safety";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Segments />
        <DemoExamples />
        <Pricing />
        <Safety />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
