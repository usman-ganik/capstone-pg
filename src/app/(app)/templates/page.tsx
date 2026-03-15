import { Card, CardContent, CardHeader } from "@/components/ui/card";

const templateIdeas = [
  "Reusable starter configs for common customer onboarding patterns.",
  "Saved Step 1 / Step 5 API recipes that can be applied to new customers.",
  "UI theme presets for supplier pages, including branding and extra fields.",
  "Approved template library for faster, more consistent implementation.",
];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Templates</div>
        <div className="text-sm text-muted-foreground">
          Reserved for reusable configuration blueprints and starter flows.
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="font-semibold">Why Keep This Section</div>
          <div className="text-sm text-muted-foreground">
            This page is a placeholder now, but it can save a lot of setup time later.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {templateIdeas.map((idea) => (
            <div key={idea} className="rounded-xl border p-3">
              {idea}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
