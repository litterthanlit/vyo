import { createFileRoute } from "@tanstack/react-router";
import { UsersService } from "@/client";

export const Route = createFileRoute("/signup")({
  component: SignUp,
});

function SignUp() {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await UsersService.registerUser({ requestBody: { email: String(data.get("email")), password: String(data.get("password")) } });
      }}
    >
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Create account</button>
    </form>
  );
}
