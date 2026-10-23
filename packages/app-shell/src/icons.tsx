import {
  BriefcaseIcon,
  CalendarIcon,
  CommandIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  HandshakeIcon,
  MessageSquareIcon,
  SparklesIcon,
} from "lucide-react"

export const WORKSPACE_APP_ICONS = {
  web: CommandIcon,
  projects: FolderIcon,
  calendars: CalendarIcon,
  files: FileIcon,
  messages: MessageSquareIcon,
  crm: HandshakeIcon,
  hr: BriefcaseIcon,
  portal: GlobeIcon,
  copilot: SparklesIcon,
} as const

export type WorkspaceAppIcon = keyof typeof WORKSPACE_APP_ICONS
