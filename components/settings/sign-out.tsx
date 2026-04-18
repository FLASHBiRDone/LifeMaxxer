export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
      >
        Logg ut
      </button>
    </form>
  );
}
