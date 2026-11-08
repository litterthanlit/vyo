import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { user } = useAuth();
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/items">Items</Link>
      <span>{user?.email}</span>
    </nav>
  );
}
