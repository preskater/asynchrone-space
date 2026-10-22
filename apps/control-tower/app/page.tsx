import { redirect } from "next/navigation"

import { getPlatformContext } from "@/lib/platform/guard"

export default async function Home() {
  const context = await getPlatformContext()
  redirect(context ? "/overview" : "/sign-in")
}
