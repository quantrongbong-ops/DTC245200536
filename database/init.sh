#!/bin/bash
# ============================================================
# Script khởi tạo database - chạy bởi PostgreSQL entrypoint
# ============================================================
set -e

echo ">>> Tạo database ứng dụng và user..."

# Tạo user ứng dụng với quyền tối thiểu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Tạo user cho ứng dụng (least privilege)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER:-appuser}') THEN
            CREATE ROLE ${APP_DB_USER:-appuser} WITH LOGIN PASSWORD '${APP_DB_PASSWORD:-apppassword}';
        END IF;
    END
    \$\$;

    -- Gán quyền tối thiểu
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${APP_DB_USER:-appuser};
    GRANT USAGE ON SCHEMA public TO ${APP_DB_USER:-appuser};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_DB_USER:-appuser};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_DB_USER:-appuser};
EOSQL

echo ">>> Chạy migration schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/migrations/001_init_schema.sql

echo ">>> Gán quyền cho bảng đã tạo..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_DB_USER:-appuser};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_USER:-appuser};
EOSQL

echo ">>> Chạy seed dữ liệu demo..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/seeds/001_seed_data.sql

echo ">>> Khởi tạo database hoàn thành!"
