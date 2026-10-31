/**
 * Database ownership and migration order. Kept dependency-free so the
 * migration, split and local-database scripts share one source of truth.
 */
export const DATABASES = [
  {
    key: "identity",
    dir: "db-identity",
    env: "IDENTITY_DATABASE_URL",
    shadowEnv: "IDENTITY_SHADOW_DATABASE_URL",
    database: "asynchrone_identity",
    shadow: "asynchrone_identity_shadow",
  },
  {
    key: "projects",
    dir: "db-projects",
    env: "PROJECTS_DATABASE_URL",
    shadowEnv: "PROJECTS_SHADOW_DATABASE_URL",
    database: "asynchrone_projects",
    shadow: "asynchrone_projects_shadow",
  },
  {
    key: "calendars",
    dir: "db-calendars",
    env: "CALENDARS_DATABASE_URL",
    shadowEnv: "CALENDARS_SHADOW_DATABASE_URL",
    database: "asynchrone_calendars",
    shadow: "asynchrone_calendars_shadow",
  },
  {
    key: "files",
    dir: "db-files",
    env: "FILES_DATABASE_URL",
    shadowEnv: "FILES_SHADOW_DATABASE_URL",
    database: "asynchrone_files",
    shadow: "asynchrone_files_shadow",
  },
  {
    key: "messages",
    dir: "db-messages",
    env: "MESSAGES_DATABASE_URL",
    shadowEnv: "MESSAGES_SHADOW_DATABASE_URL",
    database: "asynchrone_messages",
    shadow: "asynchrone_messages_shadow",
  },
  {
    key: "clients",
    dir: "db-clients",
    env: "CLIENTS_DATABASE_URL",
    shadowEnv: "CLIENTS_SHADOW_DATABASE_URL",
    database: "asynchrone_clients",
    shadow: "asynchrone_clients_shadow",
  },
  {
    key: "employees",
    dir: "db-employees",
    env: "EMPLOYEES_DATABASE_URL",
    shadowEnv: "EMPLOYEES_SHADOW_DATABASE_URL",
    database: "asynchrone_employees",
    shadow: "asynchrone_employees_shadow",
  },
  {
    key: "control-tower",
    dir: "db-control-tower",
    env: "CONTROL_TOWER_DATABASE_URL",
    shadowEnv: "CONTROL_TOWER_SHADOW_DATABASE_URL",
    database: "asynchrone_control_tower",
    shadow: "asynchrone_control_tower_shadow",
  },
]
