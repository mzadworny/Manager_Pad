import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireApiAuth } from "@/lib/api-auth";
import { toTask, type EmployeeRow, type MeetingRow, type TaskRow } from "@/types";

export const prerender = false;

const uuidSchema = z.uuid();

const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    plannedDate: z.iso.date().nullable().optional(),
    meetingId: z.uuid().optional(),
    employeeId: z.uuid().optional(),
  })
  .refine((value) => value.meetingId !== undefined || value.employeeId !== undefined, {
    message: "At least one of meetingId or employeeId is required",
  });

const TASK_LIST_ORDER = {
  completedAt: { ascending: true, nullsFirst: true },
  plannedDate: { ascending: true, nullsFirst: false },
  createdAt: { ascending: true },
} as const;

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  const employeeIdParam = context.url.searchParams.get("employeeId");
  const meetingIdParam = context.url.searchParams.get("meetingId");

  if (employeeIdParam !== null && meetingIdParam !== null) {
    return Response.json({ error: "Provide exactly one of employeeId or meetingId" }, { status: 400 });
  }
  if (employeeIdParam === null && meetingIdParam === null) {
    return Response.json(
      { error: "Exactly one of employeeId or meetingId query parameter is required" },
      { status: 400 },
    );
  }

  let employeeId: string;
  let closedInMeetingId: string | null = null;

  if (meetingIdParam !== null) {
    const meetingIdResult = uuidSchema.safeParse(meetingIdParam);
    if (!meetingIdResult.success) {
      return Response.json({ error: "meetingId query parameter must be a valid UUID" }, { status: 400 });
    }

    const meetingResult = (await auth.supabase
      .from("meetings")
      .select("id, employee_id")
      .eq("id", meetingIdResult.data)
      .maybeSingle()) as {
      data: Pick<MeetingRow, "id" | "employee_id"> | null;
      error: PostgrestError | null;
    };

    if (meetingResult.error) {
      return Response.json({ error: meetingResult.error.message }, { status: 500 });
    }
    if (!meetingResult.data) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    employeeId = meetingResult.data.employee_id;
    closedInMeetingId = meetingResult.data.id;
  } else {
    const employeeIdResult = uuidSchema.safeParse(employeeIdParam);
    if (!employeeIdResult.success) {
      return Response.json({ error: "employeeId query parameter must be a valid UUID" }, { status: 400 });
    }
    employeeId = employeeIdResult.data;
  }

  let query = auth.supabase.from("tasks").select("*").eq("employee_id", employeeId);
  if (closedInMeetingId) {
    query = query.or(`completed_at.is.null,completed_meeting_id.eq.${closedInMeetingId}`);
  }

  // Open first, then planned_date (nulls last), then created_at ascending.
  const { data, error } = await query
    .order("completed_at", TASK_LIST_ORDER.completedAt)
    .order("planned_date", TASK_LIST_ORDER.plannedDate)
    .order("created_at", TASK_LIST_ORDER.createdAt);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ tasks: (data as TaskRow[]).map(toTask) });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: z.treeifyError(parsed.error) }, { status: 400 });
  }

  let managerId: string;
  let meetingId: string | null;
  let employeeId: string;

  if (parsed.data.meetingId !== undefined) {
    const meetingResult = (await auth.supabase
      .from("meetings")
      .select("id, manager_id, employee_id")
      .eq("id", parsed.data.meetingId)
      .maybeSingle()) as {
      data: Pick<MeetingRow, "id" | "manager_id" | "employee_id"> | null;
      error: PostgrestError | null;
    };

    if (meetingResult.error) {
      return Response.json({ error: meetingResult.error.message }, { status: 500 });
    }
    if (!meetingResult.data) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (parsed.data.employeeId !== undefined && parsed.data.employeeId !== meetingResult.data.employee_id) {
      return Response.json({ error: "employeeId does not match the meeting" }, { status: 400 });
    }

    managerId = meetingResult.data.manager_id;
    meetingId = meetingResult.data.id;
    employeeId = meetingResult.data.employee_id;
  } else {
    const employeeIdInput = parsed.data.employeeId;
    if (employeeIdInput === undefined) {
      return Response.json({ error: "At least one of meetingId or employeeId is required" }, { status: 400 });
    }

    const employeeResult = (await auth.supabase
      .from("employees")
      .select("id, manager_id")
      .eq("id", employeeIdInput)
      .maybeSingle()) as {
      data: Pick<EmployeeRow, "id" | "manager_id"> | null;
      error: PostgrestError | null;
    };

    if (employeeResult.error) {
      return Response.json({ error: employeeResult.error.message }, { status: 500 });
    }
    if (!employeeResult.data) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    managerId = employeeResult.data.manager_id;
    meetingId = null;
    employeeId = employeeResult.data.id;
  }

  const result = (await auth.supabase
    .from("tasks")
    .insert({
      manager_id: managerId,
      meeting_id: meetingId,
      employee_id: employeeId,
      title: parsed.data.title,
      planned_date: parsed.data.plannedDate ?? null,
    })
    .select("*")
    .single()) as { data: TaskRow | null; error: PostgrestError | null };
  const { data, error } = result;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Failed to create task" }, { status: 500 });
  }

  return Response.json({ task: toTask(data) }, { status: 201 });
};
