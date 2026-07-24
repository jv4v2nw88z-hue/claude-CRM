import { Client, Task, User } from "@prisma/client";
import { env, isEmailEnabled } from "../config/env";

type ResendClient = { emails: { send: (payload: Record<string, unknown>) => Promise<unknown> } };

let resend: ResendClient | null = null;

function getResend(): ResendClient | null {
  if (!isEmailEnabled) return null;
  if (!resend) {
    // Required lazily so the app boots without the key configured.
    const { Resend } = require("resend") as { Resend: new (key: string) => ResendClient };
    resend = new Resend(env.RESEND_API_KEY as string);
  }
  return resend;
}

/**
 * Notifies the assignee that the automation engine created work for them.
 * With no RESEND_API_KEY set this logs instead of throwing — a missing email
 * integration must never stop a reminder task from being created.
 */
export async function sendTaskNotificationEmail(
  task: Task,
  client: Pick<Client, "id" | "businessName">,
  assignee?: Pick<User, "email" | "name"> | null
) {
  const to = assignee?.email;
  const subject = `[CRM] ${task.title}`;
  const body = [
    `${assignee?.name ? assignee.name + "," : "Hi,"}`,
    "",
    `The CRM created a new task for ${client.businessName}:`,
    "",
    `  ${task.title}`,
    task.description ? `  ${task.description}` : "",
    "",
    task.dueDate ? `Due: ${task.dueDate.toDateString()}` : "",
    "",
    "Open the CRM to log the pitch once you've made it.",
  ]
    .filter(Boolean)
    .join("\n");

  const mailer = getResend();
  if (!mailer || !to) {
    console.log(`[email:skipped] ${subject}${to ? ` -> ${to}` : " (no assignee email)"}`);
    return;
  }

  try {
    await mailer.emails.send({ from: env.MAIL_FROM, to, subject, text: body });
    console.log(`[email:sent] ${subject} -> ${to}`);
  } catch (err) {
    // A failed notification is not a reason to fail the job that created the task.
    console.error(`[email:failed] ${subject} -> ${to}`, err);
  }
}
