/**
 * Consistent Fingerprint Generator
 *
 * Generates ALL fingerprint values ONCE from a seed
 * and caches them for consistency across page loads.
 */

export interface ConsistentFingerprint {
  // Hardware
  hardwareConcurrency: number; // 4-8 cores
  deviceMemory: number; // 8 GB (fixed)

  // Canvas Noise (pre-generated pattern)
  canvasNoisePattern: number[]; // 100 random values for consistent noise

  // Audio
  audioNoiseOffset: number; // 0.0001 range
  audioNoisePattern: number[]; // For consistent audio fingerprinting

  // WebGL
  webglVendor: string; // "Intel Inc."
  webglRenderer: string; // "Intel Iris OpenGL Engine"

  // Chrome runtime timings (pre-generated)
  chromeLoadTimes: {
    requestTimeOffset: number;
    startLoadTimeOffset: number;
    commitLoadTimeOffset: number;
    finishDocumentLoadTimeOffset: number;
    firstPaintTimeOffset: number;
  };

  // CSI timings
  chromeCSI: {
    startEOffset: number;
    onloadTOffset: number;
    pageTOffset: number;
  };
}

/**
 * Generate consistent fingerprint from seed
 */
export function generateConsistentFingerprint(seed: number): ConsistentFingerprint {
  // Seeded random generator
  let state = seed;
  function seededRandom(): number {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  }

  // Generate all values ONCE
  return {
    // Hardware (fixed values per profile)
    hardwareConcurrency: 4 + Math.floor(seededRandom() * 4), // 4-8 cores
    deviceMemory: 8, // Fixed

    // Canvas Noise (100 pre-generated values for repeatable noise)
    canvasNoisePattern: Array.from({ length: 100 }, () => Math.floor(seededRandom() * 5)),

    // Audio
    audioNoiseOffset: seededRandom() * 0.0001,
    audioNoisePattern: Array.from({ length: 50 }, () => seededRandom() * 0.0001),

    // WebGL (fixed)
    webglVendor: 'Intel Inc.',
    webglRenderer: 'Intel Iris OpenGL Engine',

    // Chrome runtime timings (fixed offsets per profile)
    chromeLoadTimes: {
      requestTimeOffset: seededRandom() * 5,
      startLoadTimeOffset: seededRandom() * 3,
      commitLoadTimeOffset: seededRandom() * 2,
      finishDocumentLoadTimeOffset: seededRandom() * 1,
      firstPaintTimeOffset: seededRandom() * 0.5,
    },

    // CSI timings (fixed offsets per profile)
    chromeCSI: {
      startEOffset: seededRandom() * 5000,
      onloadTOffset: seededRandom() * 3000,
      pageTOffset: seededRandom() * 1000,
    },
  };
}

/**
 * Serialize fingerprint for injection into browser
 */
export function serializeFingerprint(fp: ConsistentFingerprint): string {
  return JSON.stringify(fp);
}
