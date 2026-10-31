-- Per-app databases for local development and the maintenance-window split.
-- The monolith database (`asynchrone`) is created by POSTGRES_DB; these are the
-- target databases owned by each app.
SELECT 'CREATE DATABASE asynchrone_identity'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_identity')\gexec
SELECT 'CREATE DATABASE asynchrone_projects'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_projects')\gexec
SELECT 'CREATE DATABASE asynchrone_calendars'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_calendars')\gexec
SELECT 'CREATE DATABASE asynchrone_files'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_files')\gexec
SELECT 'CREATE DATABASE asynchrone_messages'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_messages')\gexec
SELECT 'CREATE DATABASE asynchrone_clients'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_clients')\gexec
SELECT 'CREATE DATABASE asynchrone_employees'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_employees')\gexec
SELECT 'CREATE DATABASE asynchrone_control_tower'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_control_tower')\gexec
SELECT 'CREATE DATABASE asynchrone_identity_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_identity_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_projects_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_projects_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_calendars_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_calendars_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_files_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_files_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_messages_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_messages_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_clients_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_clients_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_employees_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_employees_shadow')\gexec
SELECT 'CREATE DATABASE asynchrone_control_tower_shadow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'asynchrone_control_tower_shadow')\gexec
