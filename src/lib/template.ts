export function applyTemplate(input: string, values: Record<string, string>) {
  return input.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}