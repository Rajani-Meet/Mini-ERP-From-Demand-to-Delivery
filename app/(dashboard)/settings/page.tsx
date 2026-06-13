import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? "Operator",
    email: session.user.email ?? "",
    role: session.user.role,
  };

  return <SettingsForm user={user} />;
}
