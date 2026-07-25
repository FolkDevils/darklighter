import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/components-model/defs"; // side-effect: registers every component kind
import { seedStarterDoc } from "@/state/store";
import "@/styles/global.css";

seedStarterDoc();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
