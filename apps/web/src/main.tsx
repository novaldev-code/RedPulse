import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./app";
import { queryClient } from "./lib/query-client";
import "./index.css";

const storedTheme = window.localStorage.getItem("redpulse-theme");
const initialTheme =
  storedTheme === "dark" || storedTheme === "light"
    ? storedTheme
    : window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";

document.documentElement.classList.toggle("dark", initialTheme === "dark");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
