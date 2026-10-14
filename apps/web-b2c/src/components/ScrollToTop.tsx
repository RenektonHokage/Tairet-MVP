import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { isPrelaunchPath } from "./prelaunch/routes";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isPrelaunchPath(pathname)) return;
    // Use setTimeout to ensure scroll happens after any immediate DOM updates
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}

export default ScrollToTop;