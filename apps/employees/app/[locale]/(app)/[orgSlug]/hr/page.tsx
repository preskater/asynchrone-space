import { redirect } from "next/navigation"

/** Keeps the old /hr bookmarks working after the Employees rename. */
export default async function LegacyHrPage({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string }>
}) {
  const { locale, orgSlug } = await params
  redirect(`/${locale}/${orgSlug}/employees`)
}
