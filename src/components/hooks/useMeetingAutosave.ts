import { useCallback, useEffect, useRef, useState } from "react";
import type { NotesJson } from "@/types";

export type MeetingSaveStatus = "idle" | "saving" | "saved" | "error";

export interface MeetingAutosaveFields {
  topics: string;
  meetingDate: string;
  notesJson: NotesJson;
}

const DEBOUNCE_MS = 600;
const SAVED_CLEAR_MS = 1500;

async function patchMeeting(meetingId: string, body: Partial<MeetingAutosaveFields>): Promise<void> {
  const response = await fetch(`/api/meetings/${meetingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to save meeting");
  }
}

/**
 * Debounced meeting field autosave with monotonic generation tokens.
 * Saved only on HTTP 2xx for the latest generation; Retry / unmount flush use live field refs.
 */
export function useMeetingAutosave(meetingId: string, initial: MeetingAutosaveFields | null) {
  const [status, setStatus] = useState<MeetingSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fieldsRef = useRef<MeetingAutosaveFields | null>(initial);
  const seededForMeetingRef = useRef<string | null>(null);
  const saveGenRef = useRef(0);
  const dirtyRef = useRef(false);
  const topicsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  useEffect(() => {
    if (!initial) {
      return;
    }
    if (seededForMeetingRef.current === meetingId) {
      return;
    }
    fieldsRef.current = initial;
    seededForMeetingRef.current = meetingId;
    dirtyRef.current = false;
  }, [initial, meetingId]);

  const markSaved = useCallback(() => {
    setStatus("saved");
    setError(null);
    if (savedClearTimer.current) {
      clearTimeout(savedClearTimer.current);
    }
    savedClearTimer.current = setTimeout(() => {
      setStatus("idle");
    }, SAVED_CLEAR_MS);
  }, []);

  const runSave = useCallback(
    async (body: Partial<MeetingAutosaveFields>) => {
      const gen = ++saveGenRef.current;
      setStatus("saving");
      setError(null);
      try {
        await patchMeeting(meetingIdRef.current, body);
        dirtyRef.current = false;
        if (gen === saveGenRef.current) {
          markSaved();
        }
      } catch (err) {
        if (gen === saveGenRef.current) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Unable to save meeting");
        }
      }
    },
    [markSaved],
  );

  const schedule = useCallback(
    (
      timer: { current: ReturnType<typeof setTimeout> | null },
      pick: (fields: MeetingAutosaveFields) => Partial<MeetingAutosaveFields>,
    ) => {
      dirtyRef.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      // Do not setStatus("saving") here — that re-renders the page on every keystroke
      // and can disturb TipTap while Backspace/Delete is applying.
      timer.current = setTimeout(() => {
        timer.current = null;
        const current = fieldsRef.current;
        if (!current) {
          return;
        }
        void runSave(pick(current));
      }, DEBOUNCE_MS);
    },
    [runSave],
  );

  const setTopics = useCallback(
    (topics: string) => {
      const current = fieldsRef.current;
      if (!current) {
        return;
      }
      fieldsRef.current = { ...current, topics };
      schedule(topicsTimer, (fields) => ({ topics: fields.topics }));
    },
    [schedule],
  );

  const setMeetingDate = useCallback(
    (meetingDate: string) => {
      const current = fieldsRef.current;
      if (!current) {
        return;
      }
      fieldsRef.current = { ...current, meetingDate };
      schedule(dateTimer, (fields) => ({ meetingDate: fields.meetingDate }));
    },
    [schedule],
  );

  const setNotesJson = useCallback(
    (notesJson: NotesJson) => {
      const current = fieldsRef.current;
      if (!current) {
        return;
      }
      fieldsRef.current = { ...current, notesJson };
      schedule(notesTimer, (fields) => ({ notesJson: fields.notesJson }));
    },
    [schedule],
  );

  const retry = useCallback(() => {
    const current = fieldsRef.current;
    if (!current) {
      return;
    }
    if (topicsTimer.current) {
      clearTimeout(topicsTimer.current);
      topicsTimer.current = null;
    }
    if (notesTimer.current) {
      clearTimeout(notesTimer.current);
      notesTimer.current = null;
    }
    if (dateTimer.current) {
      clearTimeout(dateTimer.current);
      dateTimer.current = null;
    }
    void runSave({
      topics: current.topics,
      meetingDate: current.meetingDate,
      notesJson: current.notesJson,
    });
  }, [runSave]);

  useEffect(() => {
    return () => {
      if (topicsTimer.current) {
        clearTimeout(topicsTimer.current);
      }
      if (notesTimer.current) {
        clearTimeout(notesTimer.current);
      }
      if (dateTimer.current) {
        clearTimeout(dateTimer.current);
      }
      if (savedClearTimer.current) {
        clearTimeout(savedClearTimer.current);
      }

      const current = fieldsRef.current;
      if (current && dirtyRef.current) {
        void patchMeeting(meetingIdRef.current, {
          topics: current.topics,
          meetingDate: current.meetingDate,
          notesJson: current.notesJson,
        }).catch(() => {
          // Unmount flush is best-effort; next visit will reload server state.
        });
      }
    };
  }, []);

  return {
    status,
    error,
    setTopics,
    setMeetingDate,
    setNotesJson,
    retry,
  };
}
