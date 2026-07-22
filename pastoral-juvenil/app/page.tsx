import { SiteHeader } from "@/components/layout/SiteHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/bienvenida/Hero";
import { ObjetivoGeneral } from "@/components/bienvenida/ObjetivoGeneral";
import { ObjetivosEspecificos } from "@/components/bienvenida/ObjetivosEspecificos";
import { ListaAsesores } from "@/components/bienvenida/ListaAsesores";
import { ResponsabilidadesFijas } from "@/components/bienvenida/ResponsabilidadesFijas";

// Force Cloudflare redeploy - Modern UI v2
export default function BienvenidaPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ObjetivoGeneral />
        <ObjetivosEspecificos />
        <ListaAsesores />
        <ResponsabilidadesFijas />
      </main>
      <Footer />
    </>
  );
}
