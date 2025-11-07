/**
 * Onlogist Types
 * Type definitions for Onlogist platform data structures
 */

/**
 * Search filters for Onlogist order search
 */
export interface OnlogistSearchFilters {
  // Radius in km
  umkreis: number;

  // Location filters
  startort?: string; // Starting location
  zielort?: string; // Destination

  // Date range
  von?: Date; // From date
  bis?: Date; // To date

  // Distance filter
  entfernung?: "alle" | number; // "alle" or specific km

  // Qualification filter
  qualifikation?: string;

  // Show expired orders
  ausgeblendeteAuftraegeAnzeigen?: boolean;
}

/**
 * Onlogist Order (Auftrag)
 * Represents a single order/job from Onlogist
 */
export interface OnlogistOrder {
  // Order identification
  id: string; // Internal ID (Fahrt-Nr.)
  fahrtNr: string; // Order number displayed on platform

  // Time information
  abholzeit: Date; // Pickup time
  ankunftszeit?: Date; // Arrival time

  // Location information
  startort: string; // Starting location
  startortDetails?: string; // Detailed address
  zielort: string; // Destination
  zielortDetails?: string; // Detailed address

  // Distance & Route
  entfernung: number; // Distance in km

  // Client information
  auftraggeber: string; // Client/Company name
  auftraggeberDetails?: {
    name?: string;
    phone?: string;
    email?: string;
  };

  // Pricing
  listenpreis?: number; // List price in EUR
  preisVorschlag?: number; // Price suggestion

  // Order status/flags
  isHighlighted?: boolean; // Special/featured order
  hasWarning?: boolean; // Has warnings/special notes
  requiresQualification?: boolean; // Requires specific qualification

  // Additional info
  hinweise?: string; // Notes/instructions
  fahrzeugtyp?: string; // Vehicle type required
  ladungDetails?: string; // Cargo details

  // Metadata
  metadata?: Record<string, unknown>;
  scrapedAt: Date; // When this data was scraped
}

/**
 * Onlogist session state
 */
export interface OnlogistSessionState {
  sessionId: string;
  isLoggedIn: boolean;
  lastActivity: Date;
  username?: string;
}

/**
 * Login credentials for Onlogist
 */
export interface OnlogistCredentials {
  username: string;
  password: string;
}

/**
 * Onlogist scrape result
 */
export interface OnlogistScrapeResult {
  success: boolean;
  orders: OnlogistOrder[];
  filters: OnlogistSearchFilters;
  totalFound: number;
  scrapedAt: Date;
  sessionId: string;
  error?: string;
}
