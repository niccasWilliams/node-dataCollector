# Onlogist Service

Service für die Automatisierung der Onlogist.com Plattform.

## Features

- ✅ **Login/Logout** mit Credentials
- ✅ **Suchfilter** (Umkreis, Startort, Zielort, Datum, Entfernung, etc.)
- ✅ **Auftrags-Extraktion** aus der Suchergebnisliste
- ✅ **Session-Management** mit Browser-Persistenz
- ✅ **Humanized Interactions** für Bot-Detection-Schutz

## Datenbank: Credentials

Die Login-Daten werden in der `website_credentials` Tabelle gespeichert:

```sql
-- Onlogist Website eintragen
INSERT INTO websites (domain, name, description)
VALUES ('portal.onlogist.com', 'Onlogist', 'Logistik-Plattform für Transportaufträge');

-- Credentials speichern
INSERT INTO website_credentials (website_id, username, password, label, is_active)
VALUES (
  (SELECT id FROM websites WHERE domain = 'portal.onlogist.com'),
  'dein-username',
  'dein-passwort',  -- TODO: In Production verschlüsseln!
  'Hauptaccount',
  true
);
```

## Verwendung

### 1. Login

```typescript
import { onlogistService } from "@/services/onlogist";

// Login durchführen
const session = await onlogistService.login({
  username: "dein-username",
  password: "dein-passwort",
});

console.log(`✅ Eingeloggt! Session: ${session.sessionId}`);
```

### 2. Aufträge suchen

```typescript
// Such-Filter definieren
const filters = {
  umkreis: 20, // 20km Radius
  startort: "Osnabrück",
  zielort: "Hamm",
  von: new Date("2025-11-05"),
  bis: new Date("2025-11-12"),
  entfernung: "alle",
  ausgeblendeteAuftraegeAnzeigen: false,
};

// Suche ausführen
const result = await onlogistService.searchOrders(session.sessionId, filters);

console.log(`✅ ${result.orders.length} Aufträge gefunden`);

result.orders.forEach((order) => {
  console.log(`
    Fahrt-Nr: ${order.fahrtNr}
    Von: ${order.startort} → Nach: ${order.zielort}
    Abholzeit: ${order.abholzeit}
    Entfernung: ${order.entfernung} km
    Auftraggeber: ${order.auftraggeber}
  `);
});
```

### 3. Logout

```typescript
// Session beenden
await onlogistService.logout(session.sessionId);
console.log("✅ Ausgeloggt");
```

## Komplettes Beispiel

```typescript
import { onlogistService } from "@/services/onlogist";

async function scrapeOnlogist() {
  let sessionId: string | undefined;

  try {
    // 1. Login
    const session = await onlogistService.login({
      username: process.env.ONLOGIST_USERNAME!,
      password: process.env.ONLOGIST_PASSWORD!,
    });
    sessionId = session.sessionId;

    // 2. Aufträge suchen
    const result = await onlogistService.searchOrders(sessionId, {
      umkreis: 20,
      startort: "Osnabrück",
      entfernung: "alle",
    });

    // 3. Ergebnisse verarbeiten
    console.log(`✅ ${result.totalFound} Aufträge gefunden`);

    for (const order of result.orders) {
      console.log(`${order.fahrtNr}: ${order.startort} → ${order.zielort}`);
    }

    return result.orders;
  } catch (error) {
    console.error("❌ Fehler:", error);
    throw error;
  } finally {
    // 4. Immer logout
    if (sessionId) {
      await onlogistService.logout(sessionId);
    }
  }
}

// Ausführen
scrapeOnlogist();
```

## Filter-Optionen

```typescript
interface OnlogistSearchFilters {
  umkreis: number; // Radius in km (PFLICHT)
  startort?: string; // Startort
  zielort?: string; // Zielort
  von?: Date; // Von-Datum
  bis?: Date; // Bis-Datum
  entfernung?: "alle" | number; // "alle" oder km
  qualifikation?: string; // z.B. "ADR", "Kühlwagen"
  ausgeblendeteAuftraegeAnzeigen?: boolean; // Abgelaufene anzeigen
}
```

## Auftrags-Datenstruktur

```typescript
interface OnlogistOrder {
  id: string; // Fahrt-Nr
  fahrtNr: string;
  abholzeit: Date;
  ankunftszeit?: Date;
  startort: string;
  zielort: string;
  entfernung: number; // km
  auftraggeber: string;
  listenpreis?: number; // EUR
  preisVorschlag?: number;
  hinweise?: string;
  metadata?: Record<string, unknown>;
  scrapedAt: Date;
}
```

## Wichtige Hinweise

### 🔒 Sicherheit

- **Credentials verschlüsseln**: In Production sollten Passwörter verschlüsselt gespeichert werden
- **Environment Variables**: Nutze `.env` für sensitive Daten
- **Session-Persistenz**: Sessions können in `sessionData` (JSONB) gespeichert werden

### 🤖 Bot-Detection

Der Service nutzt:

- ✅ **Humanized Interactions** (zufällige Verzögerungen, realistische Mausbewegungen)
- ✅ **Patchright Browser** (undetected Chromium)
- ✅ **Cookie-Consent Handling** (automatisch)

### ⚠️ Anonymität

Für maximale Anonymität:

- Separate Browser-Session pro Scrape
- Keine Cookie-Persistenz zwischen Sessions
- Optional: Proxy-Support (muss noch implementiert werden)

## TODO / Erweiterungen

- [ ] **Credentials-Verschlüsselung** (crypto)
- [ ] **Session-Persistenz** (Cookies speichern für Wiederverwendung)
- [ ] **Proxy-Support** (für IP-Rotation)
- [ ] **Detaillierte Order-Scraping** (Einzelansicht jedes Auftrags)
- [ ] **Benachrichtigungen** (bei neuen Aufträgen)
- [ ] **Periodisches Scraping** (Cron-Job)
- [ ] **API-Endpoints** (REST API für Frontend)
- [ ] **Datenbank-Integration** (Orders in DB speichern)

## Architektur

```
src/services/onlogist/
├── onlogist.service.ts      # Hauptservice (Login, Search, Extract)
├── onlogist.types.ts         # TypeScript-Typen
├── index.ts                  # Exports
└── README.md                 # Diese Datei
```

## Entwicklung

### Neue Filter hinzufügen

1. Typ in `onlogist.types.ts` erweitern
2. Filter-Logik in `applySearchFilters()` hinzufügen
3. CSS-Selektoren für neue Felder finden

### Order-Extraktion verbessern

Die aktuelle Extraktion ist grundlegend und muss an die tatsächliche HTML-Struktur angepasst werden.

Siehe: `extractOrders()` in `onlogist.service.ts`

### Testing

```bash
# Service testen
npm run dev
# Dann in der Console:
import { onlogistService } from './src/services/onlogist'
const session = await onlogistService.login({ username: '...', password: '...' })
```
