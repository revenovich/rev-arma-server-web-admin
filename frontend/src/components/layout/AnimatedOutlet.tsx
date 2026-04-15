import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

export function AnimatedOutlet() {
  const location = useLocation();

  // Use top-level route segment as key so tab changes within server detail
  // don't trigger page re-animation
  const animKey = (() => {
    const segments = location.pathname.split("/").filter(Boolean);
    // "/" → "home", "/servers/123" → "servers/123", "/mods" → "mods"
    if (segments.length === 0) return "home";
    if (segments[0] === "servers" && segments.length >= 2)
      return `servers/${segments[1]}`;
    return segments[0];
  })();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}