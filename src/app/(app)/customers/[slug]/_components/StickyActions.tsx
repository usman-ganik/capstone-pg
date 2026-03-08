"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function StickyActions({
  customer,
  onSaveDraft,
  savingDraft,
  onClearDraft,
  onPublish,
  publishing,
}: {
  customer: { slug: string; status: string };
  onSaveDraft: () => void;
  savingDraft: boolean;
  onClearDraft: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  return (
    <div className="lg:sticky lg:top-24 h-fit">
      <Card className="rounded-2xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Status</div>
            <Badge variant="secondary" className="rounded-full">
              Draft
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Track completion and publish when ready.
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Checklist</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Customer details</li>
              <li>• Parameters</li>
              <li>• Step 1 API & mapping</li>
              <li>• Step 5 config</li>
            </ul>
          </div>

          <div className="grid gap-2">
            <Button
  variant="outline"
  className="rounded-xl"
  onClick={onSaveDraft}
  disabled={savingDraft}
>
  {savingDraft ? "Saving…" : "Save draft"}
</Button>
<Button
  variant="ghost"
  className="rounded-xl text-red-600 hover:text-red-700"
  onClick={onClearDraft}
>
  Clear draft
</Button>
            <Button variant="outline" className="rounded-xl">Test config</Button>
            <Button
  className="rounded-xl"
  onClick={onPublish}
  disabled={publishing}
>
  {publishing ? "Publishing…" : "Publish"}
</Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Quick links</div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Step 1 URL</div>
              <Input
                readOnly
                value={`https://app.domain/pay/${customer.slug}`}
                className="rounded-xl"
              />
              <div className="text-xs text-muted-foreground">Step 5 URL</div>
              <Input
                readOnly
                value={`https://app.domain/status/${customer.slug}`}
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
