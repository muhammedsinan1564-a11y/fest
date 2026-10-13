import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { readTheme } from "./lib/theme";

// Apply the saved palette before first paint so there is no colour flash.
document.documentElement.dataset.theme = readTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
