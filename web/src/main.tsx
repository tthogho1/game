import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Note: no React.StrictMode here on purpose. StrictMode double-mounts effects in
// dev, which would briefly create two Game instances / rAF loops. The single
// canvas game manages its own lifecycle, so we keep one clean mount.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
