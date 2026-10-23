import { CrmTabs } from "@/components/crm/crm-tabs"

export default async function CrmLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}>) {
  const { orgSlug } = await params

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <CrmTabs orgSlug={orgSlug} />
      {children}
    </div>
  )
}
