import Link from "next/link";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./AddEventButton.module.css";

export function AddEventButton() {
  return (
    <Tooltip label="Requiere sesión de administrador. Clic para entrar">
      <Link href="/admin" className={styles.btn}>
        <LockSimple size={15} />
        Agregar / editar evento
      </Link>
    </Tooltip>
  );
}
