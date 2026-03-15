import { Card, CardContent, CardHeader } from "@/components/ui/card";

const settingsIdeas = [
  "Global payment-provider defaults shared across customers.",
  "Team-level publishing preferences, audit settings, and operational controls.",
  "Credential management, API export defaults, and security policies.",
  "Environment-level configuration for branding, support links, and diagnostics.",
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Settings</div>
        <div className="text-sm text-muted-foreground">
          Reserved for global platform controls and team-wide defaults.
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="font-semibold">Why Keep This Section</div>
          <div className="text-sm text-muted-foreground">
            This page is a placeholder now, but it gives us a home for shared controls as the product grows.
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {settingsIdeas.map((idea) => (
            <div key={idea} className="rounded-xl border p-3">
              {idea}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
