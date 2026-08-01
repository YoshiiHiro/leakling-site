
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { MOCK_MODE } from "../scripts/constants.js";
import {
  eventBus,
  autopsyStore,
  simulateDeath,
  endMockMatch,
  clearAllData,
  deathDetector,
} from "./controller.ts";

// Expose controller functions globally for Electron IPC / overlay window access
window.simulateDeathAutopsy = simulateDeath;
window.endMockMatch = endMockMatch;
window.owEventBus = eventBus;
window.autopsyStore = autopsyStore;
window.MOCK_MODE = MOCK_MODE;

// Debug: test snap capture from console with: testSnap()
window.testSnap = () => deathDetector.testSnapOnce();

createRoot(document.getElementById("root")!).render(<App />);
  