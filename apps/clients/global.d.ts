import en from "@workspace/i18n/messages/en"

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en
  }
}
