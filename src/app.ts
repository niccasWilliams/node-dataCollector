import express from "express";
import morgan from "morgan";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import registerRoutes from "./routes";
import { customMorganFormat } from "./util/moganFormat";
import { initializeWebsocketService } from "./lib/websocket.service.instance";
import helmet from "helmet";
import { validateEnvironmentVariables } from "./util/env-validator";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";


// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), `.env`) });

// Validate environment variables
validateEnvironmentVariables();

const app = express();

// 🌐 Umgebungserkennung
const HOST_NAME = process.env.HOST_NAME || "localhost";
const PORT_RAW = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : undefined;
if (!PORT_RAW) throw new Error("NODE_PORT is not defined or invalid");
const PORT = PORT_RAW;

const isProduction = HOST_NAME !== "localhost";

// PUBLIC_URL behalten wir für andere Dinge (WebSocket extern etc.),
// aber NICHT für Swagger. Swagger soll immer nur auf diese laufende Instanz zeigen.
const PUBLIC_URL = process.env.PUBLIC_URL || `http://${HOST_NAME}:${PORT}`;

// ─────────────────────────────
// 🔎 SWAGGER SETUP
// ─────────────────────────────

// Das sind Meta-Infos über deine API
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Automation / Browser Control API",
    version: "1.0.0",
    description:
      "Interne API zur Browser-Steuerung (Chrome Automation) und internen Jobs / Cron / Settings.",
  },
  servers: [
    {
      // GANZ WICHTIG:
      // Swagger benutzt diese URL als Basis für alle 'Try it out'-Calls.
      // Wir nehmen hier bewusst Host + Port der aktuell laufenden Instanz.
      url: `http://${HOST_NAME}:${PORT}`,
    },
  ],
};

// swagger-jsdoc sammelt aus deinen Files JSDoc-Kommentare ein
const swaggerOptions = {
  definition: swaggerDefinition,
  // einfacher und robuster für dev:
  apis: ["./src/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ─────────────────────────────
// Ende Swagger Setup
// ─────────────────────────────

// CORS
const allowedOrigins = [
  `https://${process.env.FRONTEND_HOST_NAME}`,
  `http://${process.env.FRONTEND_HOST_NAME}`,
  `http://localhost:${PORT}`,
  PUBLIC_URL,
  "http://localhost:3000",
];

const corsOptions: cors.CorsOptions = isProduction
  ? {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: "GET, POST, DELETE",
      allowedHeaders: "Content-Type, Authorization",
    }
  : {
      // dev-mode: entspannter, damit Swagger-UI aus dem gleichen Origin nicht geblockt wird
      origin: true,
      methods: "GET, POST, DELETE",
      allowedHeaders: "Content-Type, Authorization",
    };

console.log(`🌐 Runtime URL (for Swagger): http://${HOST_NAME}:${PORT}`);
console.log(`🌐 PUBLIC_URL (for you / WS etc): ${PUBLIC_URL}`);
app.use(cors(corsOptions));

// Static + Body Parser + Logger
app.use(
  "/public",
  express.static(path.resolve(process.cwd(), "public"))
);
app.use(express.json({ limit: "200mb" }));
app.use(morgan(customMorganFormat));

// ⛳ Swagger route zuerst mounten, OHNE dass Helmet uns blockt
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Danach Helmet aktivieren für den Rest
// Wichtig: Wir lassen script/style inline zu, z.B. wenn du später kleine Panels/Preview baust.
// Wenn du noch härter werden willst, kannst du Helmet NACH der dev-Phase anziehen.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// Dann deine API-Routen registrieren
registerRoutes(app);

// WebSocket usw.
const server = createServer(app);
const wss = new WebSocketServer({ server });
initializeWebsocketService(wss);

const startServer = async () => {
  server.listen(PORT, isProduction ? undefined : HOST_NAME, () => {
    if (!isProduction)
      console.warn(
        "⚠️ WARNING: Auth middleware skipped due to local environment"
      );

    console.log(`🟢 API läuft auf:         http://${HOST_NAME}:${PORT}`);
    console.log(`🟢 Swagger Docs:          http://${HOST_NAME}:${PORT}/docs`);
    console.log(
      `🟢 WebSocket läuft auf:   ${isProduction ? "wss" : "ws"}://${HOST_NAME}:${PORT}`
    );
  });
};

startServer();
