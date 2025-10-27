#!/bin/bash

echo "Starting the database reset process..."

# Wechsel in das Verzeichnis "drizzle" und Löschen der Datei mit dem Namen, der mit "000" beginnt
echo "Deleting file in 'drizzle' directory..."
cd drizzle
rm -f 000*

# Wechsel in das Verzeichnis "meta" und Löschen der Datei mit dem Namen, der mit "000" beginnt
echo "Deleting file in 'meta' directory..."
cd meta
rm -f 000*

# Ändern der _journal.json-Datei
echo "Modifying _journal.json..."
echo '{
  "version": "6",
  "dialect": "postgresql",
  "entries": []
}' > ./_journal.json  

# Zurück zum ursprünglichen Verzeichnis
cd ..
cd ..

# Generiere die neuen Dateien und setze die Datenbank zurück
echo "Running db:generate..."
npm run db:generate

echo "Running db:reset..."
npm run db:reset

echo "Database reset complete!"