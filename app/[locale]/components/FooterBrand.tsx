"use client";

import { useTranslations } from "next-intl";
import styles from "./FooterBrand.module.css";

export default function FooterBrand() {
  const t = useTranslations();

  return (
    <div className={styles.footerBrand}>
      <img src="/logo.png" alt="UAEHomeValue" className={styles.footerLogo} />
      <div>
        <div className={styles.footerTitle}>UAEHomeValue</div>
        <div className={styles.footerCopy}>
          © {new Date().getFullYear()} UAEHomeValue · {t("footer.copy")}
        </div>
      </div>
    </div>
  );
}