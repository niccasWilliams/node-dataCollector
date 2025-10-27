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


// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), `.env`) });

// Validate environment variables
validateEnvironmentVariables();

const app = express();




// 🌐 Umgebungserkennung: live oder lokal
const isProduction = process.env.HOST_NAME !== "localhost";
const HOST_NAME = process.env.HOST_NAME || "localhost";
const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : undefined;
if(!PORT) throw new Error("NODE_PORT is not defined or invalid");
const PUBLIC_URL = process.env.PUBLIC_URL || `http://${HOST_NAME}:${PORT}`;



const allowedOrigins = isProduction
  ? [
    `https://${process.env.FRONTEND_HOST_NAME}`,
    `http://${process.env.FRONTEND_HOST_NAME}`
  ]
  : ["http://localhost:3000"];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET, POST, DELETE",
  allowedHeaders: "Content-Type, Authorization",
};

console.log(`🌐 Public URL: ${PUBLIC_URL}`);
app.use(cors(corsOptions));


const imgSrcUrls = ["'self'", "data:"];
try {
  const parsedUrl = new URL(process.env.PUBLIC_URL || "");
  imgSrcUrls.push(parsedUrl.origin);
} catch {
  console.warn("⚠️ Ungültiger PUBLIC_URL Wert – wird aus CSP ausgeschlossen.");
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: imgSrcUrls,
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
  })
);


app.use('/public', express.static(path.resolve(__dirname, '../../public')));

app.use(express.json({ limit: "200mb" }));
app.use(morgan(customMorganFormat));

// Routen registrieren
registerRoutes(app);



// Server & WebSocket
const server = createServer(app);
const wss = new WebSocketServer({ server });
initializeWebsocketService(wss);



const startServer = () => {
  server.listen(PORT, isProduction ? undefined : HOST_NAME, async () => {
    if (!isProduction) console.warn("⚠️ WARNING: Auth middleware skipped due to local environment");
    console.log(`🟢 API läuft auf: http://${HOST_NAME}:${PORT}`);
    console.log(`🟢 WebSocket läuft auf: ${isProduction ? "wss" : "ws"}://${HOST_NAME}:${PORT}`);



  });
};

startServer();



