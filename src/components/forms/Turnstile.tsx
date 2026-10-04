"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import Script from "next/script";
import styles from "./Turnstile.module.css";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  reset: () => void;
}

interface Props {
  siteKey: string;
  action: "apply" | "admin_login" | "portal_login";
  onToken: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile widget. The token it produces is ALWAYS verified on the
 * server; this component only collects it.
 */
export function Turnstile({ siteKey, action, onToken, ref }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [failed, setFailed] = useState(false);
  const onTokenRef = useRef(onToken);
  useLayoutEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      theme: "auto",
      size: "flexible",
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => {
        onTokenRef.current(null);
        setFailed(true);
      },
    });
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready, siteKey, action]);

  return (
    <div className={styles.wrap}>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setFailed(true)} />
      <div ref={container} className={styles.widget} />
      {failed && (
        <p className={styles.error} role="alert">
          We couldn&apos;t load the security check. Please disable content blockers for this site and refresh.
        </p>
      )}
    </div>
  );
}
