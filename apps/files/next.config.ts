import path from "node:path"
import { fileURLToPath } from "node:url"

import createNextIntlPlugin from "next-intl/plugin"

import { createPreskNextConfig } from "@workspace/next-config"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const withNextIntl = createNextIntlPlugin()

export default withNextIntl(createPreskNextConfig(projectRoot))
