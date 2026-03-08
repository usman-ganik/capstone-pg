"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
<div className="flex w-full items-center justify-between px-6 py-3">
          <div className="text-sm text-muted-foreground">
          Customers / Configure
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">Dev</Badge>
          <Button variant="outline" size="sm">Notifications</Button>
          <Button variant="outline" size="sm">Usman</Button>
        </div>
      </div>
    </header>
  );
}
