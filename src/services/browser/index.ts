// Standard Browser Service (für normale Scraping-Tasks)
export { BrowserService } from './browser.service';
export { BrowserHandler, browserHandler } from './browser.handler';
export * from '../../types/browser.types';

// STEALTH Browser Service (für geschützte Sites wie Onlogist!)
export { BrowserStealthService, browserStealthService } from './browser-stealth.service';
export type { StealthBrowserConfig, StealthSession } from './browser-stealth.service';

// Bot-Detection Service (automatische Erkennung von Bot-Detection!)
export { BotDetectionService, botDetectionService } from './bot-detection.service';
export type { BotDetectionResult, BotDetectionIndicator } from './bot-detection.service';

// User Data Service (persistente Browser-Profile!)
export { UserDataService, userDataService } from './user-data.service';
export type { UserDataProfile } from './user-data.service';
