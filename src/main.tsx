import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/telemetry";
import { registerServiceWorker } from "./lib/pwa";

initAnalytics();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
