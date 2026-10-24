import { redirect } from "next/navigation"

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string }>
}) {
  const { locale, orgSlug } = await params
  redirect(`/${locale}/${orgSlug}/employees`)
}
