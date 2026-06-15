import { getSession } from "@/lib/adminAuth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-6">{children}</main>
    </div>
  );
}