import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { applyAppFonts } from "./lib/appFonts.ts";

// restore the saved whole-app / heading fonts before first paint
applyAppFonts();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
