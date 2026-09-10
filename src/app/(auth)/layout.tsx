export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface min-h-screen flex items-center justify-center p-space-6">
      {children}
    </div>
  );
}
