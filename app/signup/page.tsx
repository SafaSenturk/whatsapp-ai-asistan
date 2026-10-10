import AuthForm from "@/components/AuthForm";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <AuthForm mode="signup" />
    </main>
  );
}
