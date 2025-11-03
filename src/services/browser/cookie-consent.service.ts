import type { Page } from "patchright";
import type { CookieConsentConfig } from "@/types/browser.types";

type RejectCandidate = {
  selector: string;
  label: string;
};

const DEFAULT_REJECT_SELECTORS = [
  // Amazon selectors
  "#sp-cc-rejectall-link",
  "#sp-cc-reject-all-link",
  "input#sp-cc-rejectall-link",
  "button#sp-cc-rejectall-link",
  "button[data-action='sp-cc-rejectall']",
  "[data-action='sp-cc-rejectall']",

  // MediaMarkt selectors (must be checked with text content)
  // Note: button.sc-836914d0-1 has multiple uses, so we skip it here

  // Generic selectors
  "button[data-testid='reject-all-button']",
  "button[data-cookiebanner='reject_button']",
  "#onetrust-reject-all-handler",
  "button#onetrust-reject-all-handler",
  "button[aria-label='Ablehnen']",
  "button[aria-label='Alle ablehnen']",
];

const DEFAULT_REJECT_KEYWORDS = [
  "reject",
  "decline",
  "denied",
  "ablehnen",
  "abgelehnt",
  "auswahl ablehnen",
  "alle ablehnen",
  "ablehnen und fortfahren",
  "nur notwendige",
  "nur erforderliche",
  "nur essenzielle",
  "nur funktionale",
  "essenzielle cookies",
  "functional only",
  "essential only",
  "continue without",
  "continue without accepting",
  "reject all",
  "decline all",
  "keine cookies",
  "ohne zustimmung",
];

const DEFAULT_IGNORE_KEYWORDS = [
  "accept all",
  "accept",
  "agree",
  "allow",
  "consent",
  "zustimmen",
  "einverstanden",
  "alle akzeptieren",
  "allen zustimmen",
  "alle zulassen",
  "akzeptieren",
];

/**
 * Utility service to detect and reject cookie consent banners.
 */
export class CookieConsentService {
  private readonly config: CookieConsentConfig;

  constructor(config: CookieConsentConfig = {}) {
    this.config = config;
  }

  async findRejectCandidate(page: Page): Promise<RejectCandidate | null> {
    const timeout = this.config.timeout ?? 6000;
    const pollInterval = 350;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      // 1. Prefer explicit selectors from config
      const selectorCandidate = await this.trySelectors(page);
      if (selectorCandidate) {
        return selectorCandidate;
      }

      // 2. Fall back to keyword heuristics
      const heuristicCandidate = await this.tryKeywordHeuristic(page);
      if (heuristicCandidate) {
        return heuristicCandidate;
      }

      await page.waitForTimeout(pollInterval);
    }

    return null;
  }

  private async trySelectors(page: Page): Promise<RejectCandidate | null> {
    const selectors = [...new Set([...(this.config.selectors ?? []), ...DEFAULT_REJECT_SELECTORS])];
    for (const selector of selectors) {
      try {
        const handle = await page.$(selector);
        if (!handle) {
          continue;
        }

        const visible = await handle.isVisible().catch(() => false);
        if (visible) {
          const label =
            (await handle.innerText().catch(() => "")) ||
            (await handle.getAttribute("aria-label").catch(() => "")) ||
            selector;
          await handle.dispose();
          return { selector, label: label.trim() };
        }

        await handle.dispose();
      } catch {
        // Ignore selector errors
      }
    }

    return null;
  }

  async collectKeywordSelectors(page: Page, rawKeywords: string[]): Promise<string[]> {
    if (!rawKeywords.length) {
      return [];
    }

    const normalized = rawKeywords
      .map((value) => value?.toLowerCase().trim())
      .filter((value): value is string => Boolean(value?.length));

    if (!normalized.length) {
      return [];
    }

    try {
      return await page.evaluate(({ keywords }) => {
      if (!Array.isArray(keywords) || !keywords.length) {
        return [];
      }

      const normalizedKeywords = keywords
        .map((value) => (typeof value === 'string' ? value.toLowerCase().trim() : ''))
        .filter((value) => value.length);

      if (!normalizedKeywords.length) {
        return [];
      }

      const selectorSource = 'button,[role="button"],a[href],input[type="button"],input[type="submit"],.cookie-consent-button,.cc-deny';
      const escapePattern = /[:.'"\\\[\](),#]/g;
      const matches: string[] = [];
      const nodes = document.querySelectorAll(selectorSource);

      function collectText(element: HTMLElement): string {
        const parts: string[] = [];
        const innerText = element.innerText;
        if (typeof innerText === 'string' && innerText.trim().length) {
          parts.push(innerText);
        }
        const textContent = element.textContent;
        if (typeof textContent === 'string' && textContent.trim().length) {
          parts.push(textContent);
        }
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim().length) {
          parts.push(ariaLabel);
        }
        const title = element.getAttribute('title');
        if (title && title.trim().length) {
          parts.push(title);
        }
        if (element instanceof HTMLInputElement) {
          const value = element.value;
          if (value && value.trim().length) {
            parts.push(value);
          }
        }

        let combined = '';
        for (let idx = 0; idx < parts.length; idx++) {
          const segment = parts[idx];
          if (segment) {
            combined = combined ? combined + ' ' + segment : segment;
          }
        }

        return combined.replace(/\s+/g, ' ').trim();
      }

      function buildSelector(element: HTMLElement): string {
        if (element.id) {
          return '#' + element.id.replace(escapePattern, '\\$&').replace(/\s+/g, '\\ ');
        }

        const parts: string[] = [];
        let current: HTMLElement | null = element;
        let depth = 0;

        while (current && depth < 5) {
          let fragment = current.tagName.toLowerCase();

          const classList = current.classList;
          const classCount = classList.length;
          for (let idx = 0; idx < classCount && idx < 2; idx++) {
            const cls = classList.item(idx);
            if (cls) {
              fragment += '.' + cls.replace(escapePattern, '\\$&').replace(/\s+/g, '\\ ');
            }
          }

          const parent = current.parentElement;
          if (parent) {
            let siblingIndex = 0;
            let siblingCount = 0;
            for (let i = 0; i < parent.children.length; i++) {
              const sibling = parent.children.item(i);
              if (sibling && sibling.tagName === current.tagName) {
                siblingCount++;
                if (sibling === current) {
                  siblingIndex = siblingCount;
                }
              }
            }
            if (siblingCount > 1 && siblingIndex > 0) {
              fragment += `:nth-of-type(${siblingIndex})`;
            }
          }

          parts.unshift(fragment);
          current = current.parentElement as HTMLElement | null;
          depth++;
        }

        return parts.join(' > ');
      }

      function isVisible(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        if (rect.width < 5 || rect.height < 5) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
          return false;
        }
        return true;
      }

      for (let index = 0; index < nodes.length; index++) {
        const element = nodes[index] as HTMLElement | null;
        if (!element) {
          continue;
        }

        const combined = collectText(element);
        if (!combined) {
          continue;
        }

        const normalizedText = combined.toLowerCase();
        let keywordMatch = false;
        for (let k = 0; k < normalizedKeywords.length; k++) {
          const keyword = normalizedKeywords[k];
          if (keyword && normalizedText.includes(keyword)) {
            keywordMatch = true;
            break;
          }
        }

        if (!keywordMatch) {
          continue;
        }

        const clickable = element.closest('button, [role="button"], a[href], input[type="button"], input[type="submit"]') as HTMLElement | null;
        const target = clickable || element;
        if (!target || !isVisible(target)) {
          continue;
        }

        matches.push(buildSelector(target));
      }

      const unique: string[] = [];
      for (let i = 0; i < matches.length; i++) {
        const selector = matches[i];
        if (selector && !unique.includes(selector)) {
          unique.push(selector);
        }
      }

      return unique;
    }, { keywords: normalized });
    } catch (error) {
      // If page.evaluate fails, return empty array
      return [];
    }
  }

  private async tryKeywordHeuristic(page: Page): Promise<RejectCandidate | null> {
    const keywords = this.normalize(this.config.keywords, DEFAULT_REJECT_KEYWORDS);
    const ignore = this.normalize(this.config.ignoreKeywords, DEFAULT_IGNORE_KEYWORDS);

    try {
      return await page.evaluate(
      ({ keywords: keywordList, ignore: ignoreList }) => {
        const normalizedReject = Array.isArray(keywordList)
          ? keywordList.map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
          : [];
        const normalizedIgnore = Array.isArray(ignoreList)
          ? ignoreList.map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
          : [];

        const selectorSource = 'button,[role="button"],a[href],input[type="button"],input[type="submit"],.cookie-consent-button,.cc-deny';
        const escapePattern = /[:.'"\\\[\](),#]/g;

        const nodes: NodeListOf<Element> = document.querySelectorAll(selectorSource);

        for (let index = 0; index < nodes.length; index++) {
          const element = nodes[index] as HTMLElement | null;
          if (!element) {
            continue;
          }

          const textSegments: string[] = [];
          const innerText = element.innerText;
          if (typeof innerText === 'string' && innerText.trim().length) {
            textSegments.push(innerText);
          }
          const textContent = element.textContent;
          if (typeof textContent === 'string' && textContent.trim().length) {
            textSegments.push(textContent);
          }
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.trim().length) {
            textSegments.push(ariaLabel);
          }
          const title = element.getAttribute('title');
          if (title && title.trim().length) {
            textSegments.push(title);
          }
          if (element instanceof HTMLInputElement) {
            const value = element.value;
            if (value && value.trim().length) {
              textSegments.push(value);
            }
          }

          let combined = '';
          for (let t = 0; t < textSegments.length; t++) {
            const part = textSegments[t];
            if (part) {
              combined = combined ? combined + ' ' + part : part;
            }
          }
          combined = combined.replace(/\s+/g, ' ').trim();
          if (!combined) {
            continue;
          }

          const normalized = combined.toLowerCase();

          let matchesReject = false;
          for (let k = 0; k < normalizedReject.length; k++) {
            const keyword = normalizedReject[k];
            if (keyword && normalized.includes(keyword)) {
              matchesReject = true;
              break;
            }
          }

          const containsEssentialOnly =
            normalized.includes('nur notwendige') ||
            normalized.includes('nur erforderliche') ||
            normalized.includes('nur essenzielle') ||
            normalized.includes('essential only');

          if (!matchesReject && !containsEssentialOnly) {
            continue;
          }

          let matchesIgnore = false;
          for (let k = 0; k < normalizedIgnore.length; k++) {
            const keyword = normalizedIgnore[k];
            if (keyword && normalized.includes(keyword)) {
              matchesIgnore = true;
              break;
            }
          }

          if (matchesIgnore && !containsEssentialOnly) {
            continue;
          }

          const clickable = element.closest('button, [role="button"], a[href], input[type="button"], input[type="submit"]') as HTMLElement | null;
          const target: HTMLElement | null = clickable || element;
          if (!target) {
            continue;
          }

          const rect = target.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) {
            continue;
          }

          const style = window.getComputedStyle(target);
          if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
            continue;
          }

          if (target.id) {
            const escapedId = target.id.replace(escapePattern, '\\$&').replace(/\s+/g, '\\ ');
            return {
              selector: '#' + escapedId,
              label: combined,
            };
          }

          const parts: string[] = [];
          let current: HTMLElement | null = target;
          let depth = 0;

          while (current && depth < 4) {
            let fragment = current.tagName.toLowerCase();

            const classList: DOMTokenList = current.classList;
            const classCount = classList.length;
            for (let c = 0; c < classCount && c < 2; c++) {
              const cls = classList.item(c);
              if (cls) {
                const escapedClass = cls.replace(escapePattern, '\\$&').replace(/\s+/g, '\\ ');
                fragment += '.' + escapedClass;
              }
            }

            const parent: HTMLElement | null = current.parentElement;
            if (parent) {
              let siblingIndex = 0;
              let siblingCount = 0;
              for (let s = 0; s < parent.children.length; s++) {
                const sibling = parent.children.item(s) as Element | null;
                if (sibling && sibling.tagName === current.tagName) {
                  siblingCount++;
                  if (sibling === current) {
                    siblingIndex = siblingCount;
                  }
                }
              }
              if (siblingCount > 1 && siblingIndex > 0) {
                fragment += ':nth-of-type(' + siblingIndex + ')';
              }
            }

            parts.unshift(fragment);
            current = current.parentElement as HTMLElement | null;
            depth++;
          }

          return {
            selector: parts.join(' > '),
            label: combined,
          };
        }

        return null;
      },
      { keywords, ignore }
    );
    } catch (error) {
      // If page.evaluate fails (e.g., __name is not defined), return null
      // The service will fall back to other methods
      return null;
    }
  }

  private normalize(userList: string[] | undefined, defaults: string[]): string[] {
    if (!userList || userList.length === 0) {
      return defaults.map((value) => value.toLowerCase());
    }

    return Array.from(
      new Set([
        ...defaults.map((value) => value.toLowerCase()),
        ...userList.map((value) => value.toLowerCase()),
      ])
    );
  }
}
