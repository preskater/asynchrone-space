import account from "./account.json"
import activity from "./activity.json"
import announcement from "./announcement.json"
import appPages from "./appPages.json"
import assistant from "./assistant.json"
import auth from "./auth.json"
import blog from "./blog.json"
import calendars from "./calendars.json"
import common from "./common.json"
import dashboard from "./dashboard.json"
import enums from "./enums.json"
import error from "./error.json"
import errors from "./errors.json"
import files from "./files.json"
import footer from "./footer.json"
import forms from "./forms.json"
import landing from "./landing.json"
import legal from "./legal.json"
import marketing from "./marketing.json"
import meetings from "./meetings.json"
import messaging from "./messaging.json"
import metadata from "./metadata.json"
import navbar from "./navbar.json"
import notFound from "./notFound.json"
import oauth from "./oauth.json"
import org from "./org.json"
import pricing from "./pricing.json"
import projects from "./projects.json"
import sidebar from "./sidebar.json"
import toasts from "./toasts.json"
import userMenu from "./userMenu.json"

export default {
  Account: account,
  Activity: activity,
  Announcement: announcement,
  AppPages: appPages,
  Assistant: assistant,
  Auth: auth,
  Blog: blog,
  Calendars: calendars,
  Common: common,
  Dashboard: dashboard,
  Enums: enums,
  Error: error,
  Errors: errors,
  Files: files,
  Footer: footer,
  Forms: forms,
  Landing: landing,
  Legal: legal,
  Marketing: marketing,
  Meetings: meetings,
  Messaging: messaging,
  Metadata: metadata,
  Navbar: navbar,
  NotFound: notFound,
  Oauth: oauth,
  Org: org,
  Pricing: pricing,
  Projects: projects,
  Sidebar: sidebar,
  Toasts: toasts,
  UserMenu: userMenu,
} as const
