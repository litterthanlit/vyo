import { useQuery } from "@tanstack/react-query";
import { LoginService, UsersService } from "@/client";

export function useAuth() {
  const { data: user } = useQuery({ queryKey: ["currentUser"], queryFn: UsersService.readUserMe });

  async function login(email: string, password: string) {
    const res = await LoginService.loginAccessToken({ email, password });
    localStorage.setItem("access_token", res.access_token);
  }

  return { user, login };
}
