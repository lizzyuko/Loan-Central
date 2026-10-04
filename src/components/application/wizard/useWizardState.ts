"use client";

import { useCallback, useEffect, useState } from "react";
import type { WizardData } from "./types";

const STORAGE_KEY = "lc_application_progress_v1";

interface PersistedState {
  step: number;
  /** Highest step reached; completed steps can be revisited. */
  furthest: number;
  data: WizardData;
  idempotencyKey: string;
  savedAt: number;
}

/** Progress older than this is discarded rather than restored. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function freshState(): PersistedState {
  return { step: 0, furthest: 0, data: { documents: [] }, idempotencyKey: crypto.randomUUID(), savedAt: Date.now() };
}

function load(): PersistedState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.idempotencyKey || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return { ...parsed, furthest: parsed.furthest ?? parsed.step, data: { ...parsed.data, documents: parsed.data?.documents ?? [] } };
  } catch {
    return null;
  }
}

/**
 * Wizard state persisted to sessionStorage (this tab only) so a refresh
 * never loses progress. Cleared on successful submission.
 * The wizard renders client-side only, so storage can be read synchronously.
 */
export function useWizardState() {
  const [initial] = useState(() => {
    const existing = load();
    return { state: existing ?? freshState(), restored: Boolean(existing && (existing.step > 0 || existing.data.loan)) };
  });
  const [state, setState] = useState<PersistedState>(initial.state);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {
      // Storage full or disabled: progress simply won't survive a refresh.
    }
  }, [state]);

  const update = useCallback((patch: Partial<WizardData>, step?: number) => {
    setState((s) => {
      const nextStep = step ?? s.step;
      return { ...s, data: { ...s.data, ...patch }, step: nextStep, furthest: Math.max(s.furthest, nextStep) };
    });
  }, []);

  const goTo = useCallback((step: number) => {
    setState((s) => ({ ...s, step, furthest: Math.max(s.furthest, step) }));
  }, []);

  const clear = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    setState(freshState());
  }, [clear]);

  return { state, update, goTo, clear, reset, wasRestored: initial.restored };
}

/** Best-guess ISO country from the browser locale (a default only). */
export function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && /^[A-Z]{2}$/.test(region) ? region : "";
  } catch {
    return "";
  }
}
