import { RegisterCompany } from "@/components/tenant/register-company";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register a company" };

export default function RegisterPage() {
  return <RegisterCompany />;
}
