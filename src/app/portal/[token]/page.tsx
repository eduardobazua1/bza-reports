import { PortalClient } from "./portal-client";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PortalClient token={token} />;
}
