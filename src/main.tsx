import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Jini from "./Jini.tsx";
import Docs from "./Docs.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const docsPath = `${basePath}/docs`;
const isDocsRoute = window.location.pathname === docsPath || window.location.pathname.startsWith(`${docsPath}/`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {isDocsRoute ? <Docs /> : <Jini />}
    </ErrorBoundary>
  </StrictMode>,
);
