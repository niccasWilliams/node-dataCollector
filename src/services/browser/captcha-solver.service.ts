import type { Page } from "patchright";

/**
 * Supported CAPTCHA types
 */
export type CaptchaType =
  | "recaptcha_v2"
  | "recaptcha_v3"
  | "hcaptcha"
  | "funcaptcha"
  | "geetest"
  | "image"
  | "text";

/**
 * CAPTCHA provider type
 */
export type CaptchaProvider = "2captcha" | "capsolver" | "anticaptcha";

/**
 * Base CAPTCHA solver configuration
 */
export interface CaptchaSolverConfig {
  /** Provider to use */
  provider: CaptchaProvider;
  /** API key for the provider */
  apiKey: string;
  /** Timeout for solving in milliseconds */
  timeout?: number;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * reCAPTCHA v2 parameters
 */
export interface RecaptchaV2Params {
  type: "recaptcha_v2";
  /** Website URL where CAPTCHA is */
  url: string;
  /** data-sitekey attribute value */
  sitekey: string;
  /** Is invisible reCAPTCHA */
  invisible?: boolean;
}

/**
 * reCAPTCHA v3 parameters
 */
export interface RecaptchaV3Params {
  type: "recaptcha_v3";
  /** Website URL where CAPTCHA is */
  url: string;
  /** data-sitekey attribute value */
  sitekey: string;
  /** Action parameter */
  action?: string;
  /** Minimum score (0.1 - 0.9) */
  minScore?: number;
}

/**
 * hCaptcha parameters
 */
export interface HCaptchaParams {
  type: "hcaptcha";
  /** Website URL where CAPTCHA is */
  url: string;
  /** data-sitekey attribute value */
  sitekey: string;
}

/**
 * FunCaptcha parameters
 */
export interface FunCaptchaParams {
  type: "funcaptcha";
  /** Website URL where CAPTCHA is */
  url: string;
  /** Public key */
  publicKey: string;
  /** Service URL (data-surl) */
  serviceUrl?: string;
}

/**
 * GeeTest parameters
 */
export interface GeeTestParams {
  type: "geetest";
  /** Website URL */
  url: string;
  /** GT parameter */
  gt: string;
  /** Challenge parameter */
  challenge: string;
}

/**
 * Image CAPTCHA parameters
 */
export interface ImageCaptchaParams {
  type: "image";
  /** Base64 encoded image */
  image: string;
  /** Is case sensitive */
  caseSensitive?: boolean;
  /** Expected character length */
  minLength?: number;
  maxLength?: number;
}

/**
 * Text CAPTCHA parameters
 */
export interface TextCaptchaParams {
  type: "text";
  /** Question text */
  text: string;
}

/**
 * Union type of all CAPTCHA parameters
 */
export type CaptchaParams =
  | RecaptchaV2Params
  | RecaptchaV3Params
  | HCaptchaParams
  | FunCaptchaParams
  | GeeTestParams
  | ImageCaptchaParams
  | TextCaptchaParams;

/**
 * CAPTCHA solving result
 */
export interface CaptchaSolution {
  /** Solution token/text */
  solution: string;
  /** Task ID from provider */
  taskId: string;
  /** Cost in credits/balance */
  cost?: number;
  /** Time taken to solve in milliseconds */
  solveTime: number;
}

/**
 * API endpoints for different providers
 */
const PROVIDER_ENDPOINTS = {
  "2captcha": {
    create: "https://2captcha.com/in.php",
    result: "https://2captcha.com/res.php",
  },
  capsolver: {
    create: "https://api.capsolver.com/createTask",
    result: "https://api.capsolver.com/getTaskResult",
  },
  anticaptcha: {
    create: "https://api.anti-captcha.com/createTask",
    result: "https://api.anti-captcha.com/getTaskResult",
  },
};

/**
 * Service for solving CAPTCHAs using external providers
 */
export class CaptchaSolverService {
  private config: Required<CaptchaSolverConfig>;

  constructor(config: CaptchaSolverConfig) {
    this.config = {
      timeout: 120000, // 2 minutes default
      pollingInterval: 3000, // 3 seconds default
      debug: false,
      ...config,
    };
  }

  /**
   * Log debug message if debug is enabled
   */
  private debug(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[CaptchaSolver]", ...args);
    }
  }

  /**
   * Solve CAPTCHA using configured provider
   */
  async solve(params: CaptchaParams): Promise<CaptchaSolution> {
    const startTime = Date.now();
    this.debug(`Solving ${params.type} CAPTCHA...`);

    try {
      // Create task
      const taskId = await this.createTask(params);
      this.debug(`Task created: ${taskId}`);

      // Poll for result
      const solution = await this.pollResult(taskId);
      const solveTime = Date.now() - startTime;

      this.debug(`CAPTCHA solved in ${solveTime}ms`);

      return {
        solution,
        taskId,
        solveTime,
      };
    } catch (error) {
      this.debug(`Failed to solve CAPTCHA:`, error);
      throw error;
    }
  }

  /**
   * Create task with provider
   */
  private async createTask(params: CaptchaParams): Promise<string> {
    switch (this.config.provider) {
      case "2captcha":
        return this.create2CaptchaTask(params);
      case "capsolver":
        return this.createCapSolverTask(params);
      case "anticaptcha":
        return this.createAntiCaptchaTask(params);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Create task with 2Captcha
   */
  private async create2CaptchaTask(params: CaptchaParams): Promise<string> {
    const endpoint = PROVIDER_ENDPOINTS["2captcha"].create;
    const formData = new URLSearchParams();
    formData.append("key", this.config.apiKey);
    formData.append("json", "1");

    switch (params.type) {
      case "recaptcha_v2":
        formData.append("method", "userrecaptcha");
        formData.append("googlekey", params.sitekey);
        formData.append("pageurl", params.url);
        if (params.invisible) {
          formData.append("invisible", "1");
        }
        break;

      case "recaptcha_v3":
        formData.append("method", "userrecaptcha");
        formData.append("version", "v3");
        formData.append("googlekey", params.sitekey);
        formData.append("pageurl", params.url);
        if (params.action) {
          formData.append("action", params.action);
        }
        if (params.minScore) {
          formData.append("min_score", String(params.minScore));
        }
        break;

      case "hcaptcha":
        formData.append("method", "hcaptcha");
        formData.append("sitekey", params.sitekey);
        formData.append("pageurl", params.url);
        break;

      case "funcaptcha":
        formData.append("method", "funcaptcha");
        formData.append("publickey", params.publicKey);
        formData.append("pageurl", params.url);
        if (params.serviceUrl) {
          formData.append("surl", params.serviceUrl);
        }
        break;

      case "image":
        formData.append("method", "base64");
        formData.append("body", params.image);
        if (params.caseSensitive) {
          formData.append("regsense", "1");
        }
        break;

      case "text":
        formData.append("method", "post");
        formData.append("textcaptcha", params.text);
        break;

      default:
        throw new Error(`Unsupported CAPTCHA type for 2Captcha: ${params.type}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const result = (await response.json()) as { status: number; request: string };

    if (result.status !== 1) {
      throw new Error(`2Captcha error: ${result.request}`);
    }

    return result.request;
  }

  /**
   * Create task with CapSolver
   */
  private async createCapSolverTask(params: CaptchaParams): Promise<string> {
    const endpoint = PROVIDER_ENDPOINTS.capsolver.create;

    let task: Record<string, unknown>;

    switch (params.type) {
      case "recaptcha_v2":
        task = {
          type: params.invisible
            ? "ReCaptchaV2TaskProxyless"
            : "ReCaptchaV2Task",
          websiteURL: params.url,
          websiteKey: params.sitekey,
        };
        break;

      case "recaptcha_v3":
        task = {
          type: "ReCaptchaV3TaskProxyless",
          websiteURL: params.url,
          websiteKey: params.sitekey,
          pageAction: params.action,
          minScore: params.minScore,
        };
        break;

      case "hcaptcha":
        task = {
          type: "HCaptchaTaskProxyless",
          websiteURL: params.url,
          websiteKey: params.sitekey,
        };
        break;

      case "funcaptcha":
        task = {
          type: "FunCaptchaTaskProxyless",
          websiteURL: params.url,
          websitePublicKey: params.publicKey,
          funcaptchaApiJSSubdomain: params.serviceUrl,
        };
        break;

      case "geetest":
        task = {
          type: "GeeTestTaskProxyless",
          websiteURL: params.url,
          gt: params.gt,
          challenge: params.challenge,
        };
        break;

      case "image":
        task = {
          type: "ImageToTextTask",
          body: params.image,
          case: params.caseSensitive,
        };
        break;

      default:
        throw new Error(`Unsupported CAPTCHA type for CapSolver: ${params.type}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        task,
      }),
    });

    const result = (await response.json()) as {
      errorId: number;
      taskId: string;
      errorDescription?: string;
    };

    if (result.errorId !== 0) {
      throw new Error(`CapSolver error: ${result.errorDescription}`);
    }

    return result.taskId;
  }

  /**
   * Create task with Anti-Captcha
   */
  private async createAntiCaptchaTask(params: CaptchaParams): Promise<string> {
    const endpoint = PROVIDER_ENDPOINTS.anticaptcha.create;

    let task: Record<string, unknown>;

    switch (params.type) {
      case "recaptcha_v2":
        task = {
          type: "RecaptchaV2TaskProxyless",
          websiteURL: params.url,
          websiteKey: params.sitekey,
          isInvisible: params.invisible,
        };
        break;

      case "recaptcha_v3":
        task = {
          type: "RecaptchaV3TaskProxyless",
          websiteURL: params.url,
          websiteKey: params.sitekey,
          pageAction: params.action,
          minScore: params.minScore,
        };
        break;

      case "hcaptcha":
        task = {
          type: "HCaptchaTaskProxyless",
          websiteURL: params.url,
          websiteKey: params.sitekey,
        };
        break;

      case "funcaptcha":
        task = {
          type: "FunCaptchaTaskProxyless",
          websiteURL: params.url,
          websitePublicKey: params.publicKey,
          funcaptchaApiJSSubdomain: params.serviceUrl,
        };
        break;

      case "geetest":
        task = {
          type: "GeeTestTaskProxyless",
          websiteURL: params.url,
          gt: params.gt,
          challenge: params.challenge,
        };
        break;

      case "image":
        task = {
          type: "ImageToTextTask",
          body: params.image,
          case: params.caseSensitive,
        };
        break;

      default:
        throw new Error(
          `Unsupported CAPTCHA type for Anti-Captcha: ${params.type}`
        );
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        task,
      }),
    });

    const result = (await response.json()) as {
      errorId: number;
      taskId: string;
      errorDescription?: string;
    };

    if (result.errorId !== 0) {
      throw new Error(`Anti-Captcha error: ${result.errorDescription}`);
    }

    return result.taskId;
  }

  /**
   * Poll for result
   */
  private async pollResult(taskId: string): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.config.timeout) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.pollingInterval)
      );

      try {
        const result = await this.getResult(taskId);
        if (result) {
          return result;
        }
      } catch (error) {
        this.debug(`Polling error:`, error);
      }
    }

    throw new Error(`CAPTCHA solving timeout after ${this.config.timeout}ms`);
  }

  /**
   * Get result from provider
   */
  private async getResult(taskId: string): Promise<string | null> {
    switch (this.config.provider) {
      case "2captcha":
        return this.get2CaptchaResult(taskId);
      case "capsolver":
        return this.getCapSolverResult(taskId);
      case "anticaptcha":
        return this.getAntiCaptchaResult(taskId);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  /**
   * Get result from 2Captcha
   */
  private async get2CaptchaResult(taskId: string): Promise<string | null> {
    const endpoint = PROVIDER_ENDPOINTS["2captcha"].result;
    const url = `${endpoint}?key=${this.config.apiKey}&action=get&id=${taskId}&json=1`;

    const response = await fetch(url);
    const result = (await response.json()) as { status: number; request: string };

    if (result.status === 0) {
      if (result.request === "CAPCHA_NOT_READY") {
        return null;
      }
      throw new Error(`2Captcha error: ${result.request}`);
    }

    return result.request;
  }

  /**
   * Get result from CapSolver
   */
  private async getCapSolverResult(taskId: string): Promise<string | null> {
    const endpoint = PROVIDER_ENDPOINTS.capsolver.result;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        taskId,
      }),
    });

    const result = (await response.json()) as {
      errorId: number;
      status: string;
      solution?: { gRecaptchaResponse?: string; token?: string; text?: string };
      errorDescription?: string;
    };

    if (result.errorId !== 0) {
      throw new Error(`CapSolver error: ${result.errorDescription}`);
    }

    if (result.status === "processing") {
      return null;
    }

    if (result.status === "ready" && result.solution) {
      return (
        result.solution.gRecaptchaResponse ||
        result.solution.token ||
        result.solution.text ||
        ""
      );
    }

    throw new Error("CapSolver: Unexpected response");
  }

  /**
   * Get result from Anti-Captcha
   */
  private async getAntiCaptchaResult(taskId: string): Promise<string | null> {
    const endpoint = PROVIDER_ENDPOINTS.anticaptcha.result;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: this.config.apiKey,
        taskId,
      }),
    });

    const result = (await response.json()) as {
      errorId: number;
      status: string;
      solution?: { gRecaptchaResponse?: string; token?: string; text?: string };
      errorDescription?: string;
    };

    if (result.errorId !== 0) {
      throw new Error(`Anti-Captcha error: ${result.errorDescription}`);
    }

    if (result.status === "processing") {
      return null;
    }

    if (result.status === "ready" && result.solution) {
      return (
        result.solution.gRecaptchaResponse ||
        result.solution.token ||
        result.solution.text ||
        ""
      );
    }

    throw new Error("Anti-Captcha: Unexpected response");
  }

  /**
   * Auto-detect and solve reCAPTCHA v2 on page
   */
  async solveRecaptchaV2OnPage(page: Page): Promise<string | null> {
    try {
      // Find reCAPTCHA iframe
      const recaptchaFrame = page
        .frames()
        .find((frame) =>
          frame.url().includes("google.com/recaptcha/api2/anchor")
        );

      if (!recaptchaFrame) {
        this.debug("No reCAPTCHA v2 found on page");
        return null;
      }

      // Extract sitekey
      const sitekey = await page.evaluate(() => {
        const iframe = document.querySelector(
          'iframe[src*="google.com/recaptcha"]'
        ) as HTMLIFrameElement | null;
        if (!iframe) return null;

        const url = new URL(iframe.src);
        return url.searchParams.get("k");
      });

      if (!sitekey) {
        throw new Error("Could not extract reCAPTCHA sitekey");
      }

      this.debug(`Found reCAPTCHA v2 with sitekey: ${sitekey}`);

      // Solve CAPTCHA
      const solution = await this.solve({
        type: "recaptcha_v2",
        url: page.url(),
        sitekey,
      });

      // Inject solution
      await page.evaluate((token) => {
        const textarea = document.querySelector(
          'textarea[name="g-recaptcha-response"]'
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = token;
        }
      }, solution.solution);

      this.debug("reCAPTCHA v2 solved and injected");

      return solution.solution;
    } catch (error) {
      this.debug("Failed to solve reCAPTCHA v2:", error);
      throw error;
    }
  }

  /**
   * Auto-detect and solve hCaptcha on page
   */
  async solveHCaptchaOnPage(page: Page): Promise<string | null> {
    try {
      // Find hCaptcha iframe
      const hcaptchaFrame = page
        .frames()
        .find((frame) =>
          frame.url().includes("hcaptcha.com/captcha")
        );

      if (!hcaptchaFrame) {
        this.debug("No hCaptcha found on page");
        return null;
      }

      // Extract sitekey
      const sitekey = await page.evaluate(() => {
        const container = document.querySelector(
          '[data-sitekey]'
        ) as HTMLElement | null;
        return container?.getAttribute("data-sitekey");
      });

      if (!sitekey) {
        throw new Error("Could not extract hCaptcha sitekey");
      }

      this.debug(`Found hCaptcha with sitekey: ${sitekey}`);

      // Solve CAPTCHA
      const solution = await this.solve({
        type: "hcaptcha",
        url: page.url(),
        sitekey,
      });

      // Inject solution
      await page.evaluate((token) => {
        const textarea = document.querySelector(
          'textarea[name="h-captcha-response"]'
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = token;
        }
      }, solution.solution);

      this.debug("hCaptcha solved and injected");

      return solution.solution;
    } catch (error) {
      this.debug("Failed to solve hCaptcha:", error);
      throw error;
    }
  }
}
