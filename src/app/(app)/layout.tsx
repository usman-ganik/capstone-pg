import AppSidebar from "@/components/app-shell/AppSidebar";
import Topbar from "@/components/app-shell/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="flex">
        <AppSidebar />
        <div className="flex-1">
          <Topbar />
         <main className="w-full px-6 py-6">
  <div className="mx-auto w-full max-w-[1600px]">
    {children}
  </div>
</main>
        </div>
      </div>
    </div>
  );
}
