import { isEmailEnabled, mailFrom } from "../config/env";

interface TaskLike {
  title: string;
  description: string | null;
  dueDate: Date | null;
}

/**
 * Notifies the assignee that the automation engine created work for them.
 *
 * Calls Resend's REST API with `fetch` rather than the Node SDK — one less
 * dependency to bundle, and no Node built-ins to polyfill. With no
 * RESEND_API_KEY set this logs instead of throwing: a missing email integration
 * must never stop a reminder task from being created.
 */
export async function sendTaskNotificationEmail(
  env: Env,
  task: TaskLike,
  client: { id: string; businessName: string },
  assignee?: { email: string; name: string } | null
): Promise<void> {
  const to = assignee?.email;
  const subject = `[CRM] ${task.title}`;
  const body = [
    assignee?.name ? `${assignee.name},` : "Hi,",
    "",
    `The CRM created a new task for ${client.businessName}:`,
    "",
    `  ${task.title}`,
    task.description ? `  ${task.description}` : "",
    "",
    task.dueDate ? `Due: ${new Date(task.dueDate).toDateString()}` : "",
    "",
    "Open the CRM to log the pitch once you've made it.",
  ]
    .filter(Boolean)
    .join("\n");

  if (!isEmailEnabled(env) || !to) {
    console.log(`[email:skipped] ${subject}${to ? ` -> ${to}` : " (no assignee email)"}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: mailFrom(env), to, subject, text: body }),
    });

    if (!res.ok) {
      console.error(`[email:failed] ${subject} -> ${to}: ${res.status} ${await res.text()}`);
      return;
    }
    console.log(`[email:sent] ${subject} -> ${to}`);
  } catch (err) {
    // A failed notification is not a reason to fail the job that created the task.
    console.error(`[email:failed] ${subject} -> ${to}`, err);
  }
}
