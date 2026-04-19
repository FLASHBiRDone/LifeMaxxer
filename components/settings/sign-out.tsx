import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="w-full rounded-2xl border border-destructive/30 bg-card text-destructive py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Logg ut
      </button>
    </form>
  );
}
