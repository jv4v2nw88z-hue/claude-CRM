import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // A 401 means the session died; retrying just burns time before the redirect.
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

// Tells the boot watchdog in index.html to stand down. Set before render rather
// than after: if a provider throws, the ErrorBoundary inside App shows a real
// message, and the watchdog replacing the DOM on top of it would only obscure it.
declare global {
  interface Window {
    __crmBooted?: boolean;
  }
}
window.__crmBooted = true;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
