import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./public-site.module.css";

const links = [
  ["/templates", "Templates"],
  ["/examples", "Examples"],
  ["/grader", "Resume review"],
  ["/pricing", "Pricing"],
] as const;

export function PublicShell({
  children,
  active,
}: {
  children: ReactNode;
  active?: string;
}) {
  return (
    <div className={styles.site}>
      <a className={styles.skip} href="#public-main">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="AI CV Builder home">
          <span className={styles.brandMark}>
            cv<span>·</span>
          </span>
          <span>AI CV Builder</span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Public navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <Link href="/profile" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/builder" className={styles.button}>
            Open my CVs
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary>Menu</summary>
          <nav aria-label="Mobile public navigation">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={active === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
            <Link href="/profile">Sign in / Account</Link>
            <Link href="/builder">Open my CVs</Link>
          </nav>
        </details>
      </header>
      <main id="public-main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div>
          <Link href="/" className={styles.footerBrand}>
            AI CV Builder
          </Link>
          <p>Your experience, in your words.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/builder">CV library</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Data & privacy</Link>
          <Link href="/profile">Account</Link>
        </nav>
        <p className={styles.footerNote}>
          Developed by Elfasys Solution
        </p>
      </footer>
    </div>
  );
}
