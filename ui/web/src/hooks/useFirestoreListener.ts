import { useState, useEffect } from "react";
import { api } from "../api/client.ts";

export function useFirestoreListener(sessionId: string | null) {
  const [state, setState] = useState<any | null>(null);
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setState(null);
      setTelemetry(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const poll = async () => {
      try {
        const [st, telem] = await Promise.all([
          api.fetchTaskState(sessionId).catch(() => null),
          api.fetchTaskTelemetry(sessionId).catch(() => null),
        ]);
        if (isMounted) {
          setState(st);
          setTelemetry(telem);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to fetch state");
          setLoading(false);
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  return { state, telemetry, loading, error };
}
