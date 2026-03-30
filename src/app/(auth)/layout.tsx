export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md bg-background p-8 rounded-xl shadow-sm border">
        {children}
      </div>
    </div>
  );
}
