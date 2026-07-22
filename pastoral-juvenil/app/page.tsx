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
      <div style={{ padding: '40px', textAlign: 'center', background: '#1f4e79', color: 'white', minHeight: '100vh' }}>
        <h1>🎉 PASTORAL JUVENIL - IRVINASIO FUNCIONANDO</h1>
        <p>Si ves esto, los cambios se desplegaron correctamente en Cloudflare</p>
        <p>Version: 0.2.0 - Moderna y con Animaciones</p>
      </div>
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
