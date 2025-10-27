#!/bin/bash

set -e

echo "🔄 Starting schema migration process..."

# Optional: Schema-Check oder Info anzeigen
echo "📁 Current Drizzle schema: src/db/schema.ts"
echo "📂 Migrations directory: drizzle/migrations"

# Step 1: Generate migration
echo "🛠️  Generating migration..."
npx drizzle-kit generate

# Step 2: Push migration to database
echo "🚀 Applying migration to database..."
npx drizzle-kit push

# Optional: List current migration state
echo "📜 Current migration files:"
ls -1 drizzle/migrations

echo "✅ Schema migration complete!"