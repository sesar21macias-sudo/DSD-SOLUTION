import { MINISTRIES } from "@/lib/ministryFolders";
import { MinistryCard } from "./MinistryCard";
import styles from "./MinistryGrid.module.css";

export function MinistryGrid() {
  return (
    <div className={styles.grid}>
      {MINISTRIES.map((ministry, index) => (
        <MinistryCard key={ministry.id} ministry={ministry} index={index} />
      ))}
    </div>
  );
}
