// Better Auth's endpoints: GitHub sign-in and callback, get-session, sign-out. Endpoints the app
// does not use answer 404 (lib/auth.ts). The owner rule runs inside Better Auth before any user
// or session is stored.
import { getAuth } from "@/lib/auth";

async function handler(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handler as GET, handler as POST };
