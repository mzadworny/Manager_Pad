import { useCallback, useEffect, useRef, useState } from "react";
import type { MeetingStatus, NotesJson } from "@/types";

export type MeetingSaveStatus = "idle" | "saving" | "saved" | "error";

export interface MeetingAutosaveFields {
  topics: string;
  meetingDate: string;
  notesJson: NotesJson;
  observationsJson: NotesJson;
  conclusionsJson: NotesJson;
}

export interface MeetingSaveResult {
  ok: boolean;
  status?: MeetingStatus;
}

type MeetingPatchBody = Partial<MeetingAutosaveFields> & { status?: MeetingStatus };

const DEBOUNCE_MS = 600;
const SAVED_CLEAR_MS = 1500;

function snapshotFields(fields: MeetingAutosaveFields): MeetingAutosaveFields {
  return {
    topics: fields.topics,
    meetingDate: fields.meetingDate,
    notesJson: fields.notesJson,
    observationsJson: fields.observationsJson,
    conclusionsJson: fields.conclusionsJson,
  };
}

async function patchMeeting(meetingId: string, body: MeetingPatchBody): Promise<void> {
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
export function useMeetingAutosave(
  meetingId: string,
  initial: MeetingAutosaveFields | null,
  options?: { frozen?: boolean },
) {
  const [status, setStatus] = useState<MeetingSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fieldsRef = useRef<MeetingAutosaveFields | null>(initial);
  const seededForMeetingRef = useRef<string | null>(null);
  const saveGenRef = useRef(0);
  const dirtyRef = useRef(false);
  const frozenRef = useRef(options?.frozen ?? false);
  const skipContentScheduleRef = useRef(false);
  const pendingStatusRef = useRef<MeetingStatus | null>(null);
  const topicsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observationsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conclusionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingIdRef = useRef(meetingId);

  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  useEffect(() => {
    frozenRef.current = options?.frozen ?? false;
  }, [options?.frozen]);

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

  const clearContentTimers = useCallback(() => {
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
    if (observationsTimer.current) {
      clearTimeout(observationsTimer.current);
      observationsTimer.current = null;
    }
    if (conclusionsTimer.current) {
      clearTimeout(conclusionsTimer.current);
      conclusionsTimer.current = null;
    }
  }, []);

  const runSave = useCallback(
    async (body: MeetingPatchBody): Promise<MeetingSaveResult> => {
      const gen = ++saveGenRef.current;
      if (body.status) {
        pendingStatusRef.current = body.status;
        skipContentScheduleRef.current = true;
      }
      setStatus("saving");
      setError(null);
      try {
        await patchMeeting(meetingIdRef.current, body);
        dirtyRef.current = false;
        pendingStatusRef.current = null;
        skipContentScheduleRef.current = false;
        if (body.status === "completed") {
          frozenRef.current = true;
        } else if (body.status === "open") {
          frozenRef.current = false;
        }
        if (gen === saveGenRef.current) {
          markSaved();
        }
        return { ok: true, status: body.status };
      } catch (err) {
        skipContentScheduleRef.current = false;
        if (gen === saveGenRef.current) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Unable to save meeting");
        }
        return { ok: false, status: body.status };
      }
    },
    [markSaved],
  );

  const schedule = useCallback(
    (
      timer: { current: ReturnType<typeof setTimeout> | null },
      pick: (fields: MeetingAutosaveFields) => Partial<MeetingAutosaveFields>,
    ) => {
      if (frozenRef.current || skipContentScheduleRef.current) {
        return;
      }
      dirtyRef.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      // Do not setStatus("saving") here — that re-renders the page on every keystroke
      // and can disturb TipTap while Backspace/Delete is applying.
      timer.current = setTimeout(() => {
        timer.current = null;
        const current = fieldsRef.current;
        if (!current || frozenRef.current || skipContentScheduleRef.current) {
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

  const setObservationsJson = useCallback(
    (observationsJson: NotesJson) => {
      const current = fieldsRef.current;
      if (!current) {
        return;
      }
      fieldsRef.current = { ...current, observationsJson };
      schedule(observationsTimer, (fields) => ({ observationsJson: fields.observationsJson }));
    },
    [schedule],
  );

  const setConclusionsJson = useCallback(
    (conclusionsJson: NotesJson) => {
      const current = fieldsRef.current;
      if (!current) {
        return;
      }
      fieldsRef.current = { ...current, conclusionsJson };
      schedule(conclusionsTimer, (fields) => ({ conclusionsJson: fields.conclusionsJson }));
    },
    [schedule],
  );

  const flush = useCallback(
    async (nextStatus?: MeetingStatus): Promise<MeetingSaveResult> => {
      clearContentTimers();
      const current = fieldsRef.current;
      if (!current) {
        return { ok: false, status: nextStatus };
      }
      const body: MeetingPatchBody = snapshotFields(current);
      if (nextStatus) {
        body.status = nextStatus;
      }
      return runSave(body);
    },
    [clearContentTimers, runSave],
  );

  const retry = useCallback(async (): Promise<MeetingSaveResult> => {
    const current = fieldsRef.current;
    if (!current) {
      return { ok: false };
    }
    clearContentTimers();
    const body: MeetingPatchBody = snapshotFields(current);
    if (pendingStatusRef.current) {
      body.status = pendingStatusRef.current;
    }
    return runSave(body);
  }, [clearContentTimers, runSave]);

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
      if (observationsTimer.current) {
        clearTimeout(observationsTimer.current);
      }
      if (conclusionsTimer.current) {
        clearTimeout(conclusionsTimer.current);
      }
      if (savedClearTimer.current) {
        clearTimeout(savedClearTimer.current);
      }

      const current = fieldsRef.current;
      const pendingStatus = pendingStatusRef.current;
      if (!current) {
        return;
      }
      if (frozenRef.current && pendingStatus !== "open") {
        return;
      }
      if (!dirtyRef.current && !pendingStatus) {
        return;
      }
      const body: MeetingPatchBody = snapshotFields(current);
      if (pendingStatus) {
        body.status = pendingStatus;
      }
      void patchMeeting(meetingIdRef.current, body).catch(() => {
        // Unmount flush is best-effort; next visit will reload server state.
      });
    };
  }, []);

  return {
    status,
    error,
    setTopics,
    setMeetingDate,
    setNotesJson,
    setObservationsJson,
    setConclusionsJson,
    flush,
    retry,
  };
}
