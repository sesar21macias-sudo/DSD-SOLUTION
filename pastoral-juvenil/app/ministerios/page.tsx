import { SiteHeader } from "@/components/layout/SiteHeader";
import { Footer } from "@/components/layout/Footer";
import { MinistryGrid } from "@/components/ministerios/MinistryGrid";
import styles from "./page.module.css";

export default function SeleccionMinisterioPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <div className={`container ${styles.section}`}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Paso 1 de 1</span>
            <h1 className={styles.title}>¿Desde qué ministerio entras hoy?</h1>
            <p className={styles.subtitle}>
              Elige tu ministerio para personalizar el agente, el calendario y las tareas.
              No necesitas contraseña, solo si vas a editar el calendario como administrador.
            </p>
          </div>
          <MinistryGrid />
        </div>
      </main>
      <Footer />
    </>
  );
}
