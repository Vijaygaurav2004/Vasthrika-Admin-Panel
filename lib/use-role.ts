import { useAuth } from "@/context/auth-context";
import { isAdminEmail } from "./role";

/** True when the logged-in user is the owner/admin (may see money + website admin). */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return isAdminEmail(user?.email);
}

/** The current user's email — recorded as who added/sold a saree. */
export function useActor(): string | undefined {
  const { user } = useAuth();
  return user?.email ?? undefined;
}
