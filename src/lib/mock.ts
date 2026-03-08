export function getMockCustomers() {
  return [
    { name: "ACME Corp", slug: "acme", status: "Active" as const, updatedHuman: "2 days ago" },
    { name: "Globex", slug: "globex", status: "Inactive" as const, updatedHuman: "18 days ago" },
    { name: "Initech", slug: "initech", status: "Active" as const, updatedHuman: "1 month ago" },
  ];
}

export function getMockCustomerBySlug(slug: string) {
  const c = getMockCustomers().find((x) => x.slug === slug);
  return c ?? { name: slug.toUpperCase(), slug, status: "Inactive" as const, updatedHuman: "—" };
}
