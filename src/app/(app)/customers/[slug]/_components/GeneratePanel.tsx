"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function GeneratePanel({ title, url }: { title: string; url: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">
            Create/update a customer-specific page URL.
          </div>
        </div>
        <Button className="rounded-xl">Create / Update</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground">Generated URL</div>
        <div className="flex gap-2">
          <Input readOnly value={url} className="rounded-xl" />
          <Button variant="outline" className="rounded-xl">Copy</Button>
        </div>
      </CardContent>
    </Card>
  );
}
