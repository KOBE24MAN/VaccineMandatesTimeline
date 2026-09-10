import { useCallback, useEffect, useState } from "react";
import type { EventIndex } from "../types/event";
import { buildEvents, parseMandates } from "../utils/mandates";

export function useEvents() {
  const [data, setData] = useState<{
    events: EventIndex[];
    allEvents: EventIndex[];
    warnings: string[];
  }>({ events: [], allEvents: [], warnings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${import.meta.env.BASE_URL}vaccine_mandates.csv`, {
      signal: controller.signal,
      cache: "no-cache",
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(
            `The mandate data could not be loaded (HTTP ${response.status}).`,
          );
        return response.text();
      })
      .then((text) => {
        if (!controller.signal.aborted)
          setData(buildEvents(parseMandates(text)));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "The mandate data could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const fetchDetail = useCallback(
    async (id: string) => {
      const event = data.allEvents.find((item) => item.id === id);
      if (!event) throw new Error(`Mandate ${id} was not found.`);
      return event;
    },
    [data.allEvents],
  );
  return {
    ...data,
    loading,
    error,
    fetchDetail,
    retry: () => setAttempt((value) => value + 1),
  };
}
