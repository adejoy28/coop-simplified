import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply initial theme attribute before first paint
try {
  const savedTheme = localStorage.getItem("alpha_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
