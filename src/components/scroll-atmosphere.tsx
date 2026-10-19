"use client";

import { useEffect } from "react";

export function ScrollAtmosphere() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty("--scroll-y", `${window.scrollY}px`);
      root.style.setProperty("--scroll-progress", String(window.scrollY / scrollable));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere__orb atmosphere__orb--one" />
      <div className="atmosphere__orb atmosphere__orb--two" />
      <div className="atmosphere__grid" />
      <div className="atmosphere__ribbon">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
