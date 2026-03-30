import { cookies } from "next/headers";
import { PortalClient } from "./portal-client";
import { PortalLogin } from "./portal-login";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Check for portal session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal-session")?.value;

  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      if (session.verified && session.token === token) {
        return <PortalClient token={token} userName={session.name} />;
      }
    } catch {}
  }

  // Not logged in — show login
  return <PortalLogin token={token} />;
}
