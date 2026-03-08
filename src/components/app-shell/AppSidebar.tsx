"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/customers", label: "Customers" },
  { href: "/payments", label: "Payments" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "Settings" },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-64 border-r bg-background">
      <div className="px-5 py-5">
        <div className="text-lg font-semibold">Tender Fee Configurator</div>
        <div className="mt-1 text-xs text-muted-foreground">Modern SaaS UI</div>
      </div>

      <nav className="px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
