"use client";

import { useEffect } from "react";

type NavigationWarningOptions = {
  enabled: boolean;
  message: string;
};

const GUARD_STATE_KEY = "__cascadeChaosNavigationGuard";

export function useNavigationWarning({
  enabled,
  message,
}: NavigationWarningOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const currentUrl = window.location.href;

    if (!window.history.state?.[GUARD_STATE_KEY]) {
      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          [GUARD_STATE_KEY]: true,
        },
        "",
        currentUrl,
      );
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };

    const handlePopState = () => {
      const shouldLeave = window.confirm(message);

      if (shouldLeave) {
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
        return;
      }

      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          [GUARD_STATE_KEY]: true,
        },
        "",
        currentUrl,
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, message]);
}
