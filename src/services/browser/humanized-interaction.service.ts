import type { Page } from "patchright";

/**
 * Point in 2D space
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Configuration for humanized interactions
 */
export interface HumanizedInteractionConfig {
  /** Minimum time for mouse movement in ms */
  minMovementTime: number;
  /** Maximum time for mouse movement in ms */
  maxMovementTime: number;
  /** Minimum delay between actions in ms */
  minActionDelay: number;
  /** Maximum delay between actions in ms */
  maxActionDelay: number;
  /** Minimum typing speed in ms per character */
  minTypingSpeed: number;
  /** Maximum typing speed in ms per character */
  maxTypingSpeed: number;
  /** Probability of making a typo (0-1) */
  typoProbability: number;
  /** Number of control points for Bezier curve (more = more natural) */
  bezierControlPoints: number;
  /** Amount of overshoot when reaching target (0-1) */
  overshootProbability: number;
  /** Maximum overshoot distance in pixels */
  maxOvershoot: number;
  /** Probability of adding random mouse movements (0-1) */
  randomMovementProbability: number;
}

/**
 * Default configuration for humanized interactions
 */
const DEFAULT_CONFIG: HumanizedInteractionConfig = {
  minMovementTime: 100,
  maxMovementTime: 500,
  minActionDelay: 50,
  maxActionDelay: 300,
  minTypingSpeed: 50,
  maxTypingSpeed: 150,
  typoProbability: 0.03,
  bezierControlPoints: 3,
  overshootProbability: 0.15,
  maxOvershoot: 10,
  randomMovementProbability: 0.2,
};

/**
 * Service for humanized browser interactions
 * Provides natural mouse movements, typing patterns, and delays
 */
export class HumanizedInteractionService {
  private config: HumanizedInteractionConfig;
  private currentPosition: Point = { x: 0, y: 0 };

  constructor(config: Partial<HumanizedInteractionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate random number between min and max
   */
  private random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(this.random(min, max + 1));
  }

  /**
   * Sleep for a random duration
   */
  private async randomDelay(min?: number, max?: number): Promise<void> {
    const minDelay = min ?? this.config.minActionDelay;
    const maxDelay = max ?? this.config.maxActionDelay;
    const delay = this.random(minDelay, maxDelay);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Calculate Bezier curve point at time t (0-1)
   */
  private bezierPoint(t: number, points: Point[]): Point {
    if (points.length === 1) {
      return points[0];
    }

    const newPoints: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      newPoints.push({
        x: (1 - t) * p1.x + t * p2.x,
        y: (1 - t) * p1.y + t * p2.y,
      });
    }

    return this.bezierPoint(t, newPoints);
  }

  /**
   * Generate control points for Bezier curve between start and end
   */
  private generateControlPoints(start: Point, end: Point): Point[] {
    const points: Point[] = [start];

    // Add control points with random offsets
    for (let i = 0; i < this.config.bezierControlPoints; i++) {
      const t = (i + 1) / (this.config.bezierControlPoints + 1);
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;

      // Add random perpendicular offset for more natural curve
      const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      const maxOffset = Math.min(distance * 0.3, 100);
      const offsetX = this.random(-maxOffset, maxOffset);
      const offsetY = this.random(-maxOffset, maxOffset);

      points.push({
        x: baseX + offsetX,
        y: baseY + offsetY,
      });
    }

    points.push(end);
    return points;
  }

  /**
   * Generate path points along Bezier curve
   */
  private generateBezierPath(start: Point, end: Point, steps: number): Point[] {
    const controlPoints = this.generateControlPoints(start, end);
    const path: Point[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Use easing function for more natural acceleration/deceleration
      const easedT = this.easeInOutCubic(t);
      const point = this.bezierPoint(easedT, controlPoints);
      path.push(point);
    }

    return path;
  }

  /**
   * Easing function for natural acceleration/deceleration
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Add overshoot to target position (sometimes humans overshoot and correct)
   */
  private addOvershoot(target: Point): Point[] {
    if (Math.random() > this.config.overshootProbability) {
      return [target];
    }

    const overshoot = this.random(5, this.config.maxOvershoot);
    const angle = this.random(0, Math.PI * 2);

    const overshootPoint: Point = {
      x: target.x + Math.cos(angle) * overshoot,
      y: target.y + Math.sin(angle) * overshoot,
    };

    return [overshootPoint, target];
  }

  /**
   * Move mouse to target position using humanized Bezier curve
   */
  async moveMouseTo(page: Page, target: Point): Promise<void> {
    const start = this.currentPosition;
    const distance = Math.sqrt(
      Math.pow(target.x - start.x, 2) + Math.pow(target.y - start.y, 2)
    );

    // Calculate movement time based on distance
    const baseTime = this.random(
      this.config.minMovementTime,
      this.config.maxMovementTime
    );
    const movementTime = Math.min(baseTime + distance * 0.5, 2000);

    // Calculate number of steps (more steps for longer distances)
    const steps = Math.max(Math.floor(distance / 10), 10);

    // Generate path with optional overshoot
    const targets = this.addOvershoot(target);
    const allPoints: Point[] = [];

    let currentStart = start;
    for (const currentTarget of targets) {
      const pathSegment = this.generateBezierPath(
        currentStart,
        currentTarget,
        Math.floor(steps / targets.length)
      );
      allPoints.push(...pathSegment);
      currentStart = currentTarget;
    }

    // Move along the path
    const timePerStep = movementTime / allPoints.length;

    for (const point of allPoints) {
      await page.mouse.move(point.x, point.y);
      this.currentPosition = point;

      // Variable delay between steps for more natural movement
      const stepDelay = timePerStep * this.random(0.5, 1.5);
      await new Promise((resolve) => setTimeout(resolve, stepDelay));
    }
  }

  /**
   * Click at position with humanized movement and timing
   */
  async clickAt(
    page: Page,
    target: Point,
    options: { button?: "left" | "right" | "middle"; clickCount?: number } = {}
  ): Promise<void> {
    // Move to target
    await this.moveMouseTo(page, target);

    // Random delay before clicking
    await this.randomDelay();

    // Click with natural timing
    const button = options.button ?? "left";
    const clickCount = options.clickCount ?? 1;

    for (let i = 0; i < clickCount; i++) {
      await page.mouse.down({ button });
      await this.randomDelay(50, 150); // Natural click duration
      await page.mouse.up({ button });

      if (i < clickCount - 1) {
        await this.randomDelay(100, 300); // Delay between double-clicks
      }
    }

    // Random delay after clicking
    await this.randomDelay();
  }

  /**
   * Click on element with humanized movement
   */
  async clickElement(
    page: Page,
    selector: string,
    options: { button?: "left" | "right" | "middle"; clickCount?: number } = {}
  ): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Element has no bounding box: ${selector}`);
    }

    // Click at random position within element (humans don't click exact center)
    const target: Point = {
      x: box.x + this.random(box.width * 0.3, box.width * 0.7),
      y: box.y + this.random(box.height * 0.3, box.height * 0.7),
    };

    await this.clickAt(page, target, options);
  }

  /**
   * Type text with humanized timing and occasional typos
   */
  async typeText(page: Page, text: string, selector?: string): Promise<void> {
    if (selector) {
      await this.clickElement(page, selector);
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate typo occasionally
      if (Math.random() < this.config.typoProbability && i < text.length - 1) {
        // Type wrong character
        const wrongChar = String.fromCharCode(
          char.charCodeAt(0) + this.randomInt(-2, 2)
        );
        await page.keyboard.type(wrongChar);
        await this.randomDelay(
          this.config.minTypingSpeed,
          this.config.maxTypingSpeed
        );

        // Correct it (backspace + correct char)
        await page.keyboard.press("Backspace");
        await this.randomDelay(
          this.config.minTypingSpeed / 2,
          this.config.maxTypingSpeed / 2
        );
      }

      // Type the character
      await page.keyboard.type(char);

      // Variable typing speed
      const typingSpeed = this.random(
        this.config.minTypingSpeed,
        this.config.maxTypingSpeed
      );

      // Longer pause after punctuation or space
      const isPunctuation = /[.,!?;:\s]/.test(char);
      const delayMultiplier = isPunctuation ? this.random(1.5, 2.5) : 1;

      await new Promise((resolve) =>
        setTimeout(resolve, typingSpeed * delayMultiplier)
      );
    }
  }

  /**
   * Scroll page with humanized behavior
   */
  async scroll(
    page: Page,
    options: {
      direction?: "up" | "down";
      amount?: number;
      smooth?: boolean;
    } = {}
  ): Promise<void> {
    const direction = options.direction ?? "down";
    const amount = options.amount ?? this.randomInt(200, 600);
    const smooth = options.smooth ?? true;

    if (smooth) {
      // Scroll in smaller increments for smooth effect
      const steps = this.randomInt(10, 20);
      const stepAmount = amount / steps;

      for (let i = 0; i < steps; i++) {
        const delta = direction === "down" ? stepAmount : -stepAmount;
        await page.mouse.wheel(0, delta);
        await this.randomDelay(20, 50);
      }
    } else {
      const delta = direction === "down" ? amount : -amount;
      await page.mouse.wheel(0, delta);
    }

    await this.randomDelay();
  }

  /**
   * Perform random mouse movement to simulate human reading/browsing
   */
  async randomMouseMovement(page: Page): Promise<void> {
    if (Math.random() > this.config.randomMovementProbability) {
      return;
    }

    const viewport = page.viewportSize();
    if (!viewport) return;

    const target: Point = {
      x: this.random(viewport.width * 0.2, viewport.width * 0.8),
      y: this.random(viewport.height * 0.2, viewport.height * 0.8),
    };

    await this.moveMouseTo(page, target);
  }

  /**
   * Update current mouse position (useful after page navigation)
   */
  updatePosition(position: Point): void {
    this.currentPosition = position;
  }

  /**
   * Get current mouse position
   */
  getPosition(): Point {
    return { ...this.currentPosition };
  }

  /**
   * Perform human-like page interaction (reading simulation)
   */
  async simulateReading(page: Page, duration?: number): Promise<void> {
    const readingTime = duration ?? this.randomInt(2000, 5000);
    const startTime = Date.now();

    while (Date.now() - startTime < readingTime) {
      await this.randomMouseMovement(page);
      await this.randomDelay(500, 2000);

      // Occasionally scroll while reading
      if (Math.random() < 0.3) {
        await this.scroll(page, {
          direction: "down",
          amount: this.randomInt(100, 300),
        });
      }
    }
  }
}

export const humanizedInteraction = new HumanizedInteractionService();
