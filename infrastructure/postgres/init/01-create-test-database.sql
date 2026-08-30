SELECT 'CREATE DATABASE kukugest_test OWNER kukugest'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kukugest_test')\gexec
