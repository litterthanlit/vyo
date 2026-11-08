import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  return <h1>Hi, {user?.full_name ?? user?.email}</h1>;
}
