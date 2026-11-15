"use client";
import { useEffect } from "react";

/**
 * Registers the shared Learn in Public elements, <kr-roadmaps> and <kr-next-roadmap> (app/design/roadmaps.js).
 * Loaded after hydration on purpose: the elements render into their own shadow roots, and upgrading them before
 * React hydrates would make the server HTML and the client tree disagree.
 */
export default function FamilyElements() {
  useEffect(() => {
    import("@/app/design/roadmaps.js").catch(() => {
      /* the switcher is optional: the app works without it */
    });
  }, []);
  return null;
}
