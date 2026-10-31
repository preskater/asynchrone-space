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
