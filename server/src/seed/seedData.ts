import type { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";
import type { RuleAnchor, ServiceTierType, TaskType } from "../domain/enums";
import { DEFAULT_PIPELINE_STAGES } from "../utils/validation";

/**
 * Seeding runs inside the Worker.
 *
 * D1 is only reachable through a binding, so there is no `tsx prisma/seed.ts`
 * that can connect to it from a laptop. Instead this lives in the Worker and is
 * triggered over HTTP by `scripts/seed.ts` (guarded by SEED_SECRET), which works
 * identically against `wrangler dev` and the deployed database.
 */

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d;
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months, 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export interface SeedResult {
  usersSeeded: boolean;
  rulesSeeded: number;
  clientsSeeded: number;
  /**
   * Generated passwords, returned exactly once — on the run that created the
   * account. Re-running the seed does not reissue them, because upsert leaves an
   * existing user untouched. If they're lost, the recovery path is a reset, not
   * another seed.
   */
  credentials: Array<{ email: string; password: string }>;
  message: string;
}

/**
 * A generated first password.
 *
 * The old default was the literal string `changeme123`, identical for both
 * accounts and printed in the README — which meant anyone who could read the
 * repository could sign in to production, and the instruction to change it
 * pointed at a feature that did not exist. Each account now gets its own random
 * secret, shown once, with `mustChangePassword` forcing a reset on first use.
 */
function generatePassword(): string {
  // Ambiguous glyphs removed: this gets read off a screen and typed on a phone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function runSeed(prisma: PrismaClient, env: Env): Promise<SeedResult> {
  const credentials: Array<{ email: string; password: string }> = [];

  /**
   * `update: {}` is load-bearing — re-running the seed must never reset a
   * password someone has already changed. Only a create issues a credential,
   * which is why `credentials` is empty on every subsequent run.
   */
  async function upsertUser(name: string, email: string, role: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    // SEED_PASSWORD stays supported so local development can pin a known value;
    // it is deliberately not defaulted.
    const password = env.SEED_PASSWORD || generatePassword();
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
        mustChangePassword: true,
      },
    });
    credentials.push({ email, password });
    return user;
  }

  const brian = await upsertUser("Brian", "brian@midigitalexpansion.com", "TECHNICAL");
  const cole = await upsertUser("Cole", "cole@midigitalexpansion.com", "SALES");

  const rulesSeeded = await seedAutomationRules(prisma);
  // Before any deal is written — a deal cannot exist without a stage to sit in.
  await seedPipelineStages(prisma);

  const existingClients = await prisma.client.count();
  if (existingClients > 0) {
    return {
      usersSeeded: true,
      rulesSeeded,
      clientsSeeded: 0,
      credentials,
      message:
        `${existingClients} client(s) already present, left client data alone.` +
        (credentials.length > 0
          ? ` New user account(s) were created — the passwords below are shown once.`
          : ""),
    };
  }

  // ---------------------------------------------------------------
  // The five current clients, seeded with the history that makes the
  // dashboard tell the truth on day one — including Sunrise Cafe sitting
  // at WEBSITE_LIVE with no retainer, which is exactly the leak this CRM exists to plug.
  // ---------------------------------------------------------------

  await prisma.client.create({
    data: {
      businessName: "Sunrise Cafe",
      industry: "Restaurant",
      city: "Battle Creek",
      state: "MI",
      currentTier: "WEBSITE_LIVE",
      accountOwnerId: cole.id,
      websiteLaunchDate: daysAgo(74),
      websiteUrl: "https://sunrisecafe.example.com",
      notes: "Owner is warm on brand work but wants to see traffic numbers first.",
      contacts: {
        create: {
          firstName: "Dana",
          lastName: "Whitfield",
          title: "Owner",
          email: "dana@sunrisecafe.example.com",
          phone: "(269) 555-0142",
          isPrimary: true,
        },
      },
      serviceHistory: {
        create: [
          {
            fromTier: "PROSPECT",
            toTier: "WEBSITE_BUILD",
            changedAt: daysAgo(110),
            changedById: cole.id,
          },
          {
            fromTier: "WEBSITE_BUILD",
            toTier: "WEBSITE_LIVE",
            changedAt: daysAgo(74),
            changedById: brian.id,
          },
        ],
      },
      interactions: {
        create: [
          {
            type: "CALL",
            summary:
              "Walked Dana through the launched site. She loves it. No retainer discussed yet.",
            occurredAt: daysAgo(72),
            loggedById: cole.id,
          },
        ],
      },
    },
  });

  await prisma.client.create({
    data: {
      businessName: "Hamilton Landscape Supply",
      industry: "Landscaping",
      city: "Hamilton",
      state: "MI",
      currentTier: "BRAND_CURATION",
      accountOwnerId: cole.id,
      websiteLaunchDate: daysAgo(180),
      websiteUrl: "https://hamiltonlandscape.example.com",
      contacts: {
        create: {
          firstName: "Rick",
          lastName: "Hamilton",
          title: "Owner",
          email: "rick@hamiltonlandscape.example.com",
          phone: "(269) 555-0188",
          isPrimary: true,
        },
      },
      retainers: {
        create: {
          tier: "BRAND_CURATION",
          monthlyAmount: 600,
          status: "ACTIVE",
          startDate: monthsAgo(3),
          billingDay: 1,
        },
      },
      serviceHistory: {
        create: [
          {
            fromTier: "PROSPECT",
            toTier: "WEBSITE_BUILD",
            changedAt: daysAgo(220),
            changedById: cole.id,
          },
          {
            fromTier: "WEBSITE_BUILD",
            toTier: "WEBSITE_LIVE",
            changedAt: daysAgo(180),
            changedById: brian.id,
          },
          {
            fromTier: "WEBSITE_LIVE",
            toTier: "BRAND_CURATION",
            changedAt: monthsAgo(3),
            changedById: cole.id,
          },
        ],
      },
      interactions: {
        create: [
          {
            type: "MEETING",
            summary: "Signed brand curation at $600/mo. Logo refresh and signage first.",
            occurredAt: monthsAgo(3),
            loggedById: cole.id,
          },
        ],
      },
    },
  });

  await prisma.client.create({
    data: {
      businessName: "Royal Kicks",
      industry: "Retail",
      city: "Kalamazoo",
      state: "MI",
      currentTier: "SOCIAL_MEDIA",
      accountOwnerId: cole.id,
      websiteLaunchDate: daysAgo(300),
      websiteUrl: "https://royalkicks.example.com",
      contacts: {
        create: {
          firstName: "Marcus",
          lastName: "Reed",
          title: "Owner",
          email: "marcus@royalkicks.example.com",
          phone: "(269) 555-0121",
          isPrimary: true,
        },
      },
      retainers: {
        create: {
          tier: "SOCIAL_MEDIA",
          monthlyAmount: 850,
          status: "ACTIVE",
          startDate: monthsAgo(1),
          billingDay: 15,
        },
      },
      serviceHistory: {
        create: [
          {
            fromTier: "PROSPECT",
            toTier: "WEBSITE_BUILD",
            changedAt: daysAgo(340),
            changedById: cole.id,
          },
          {
            fromTier: "WEBSITE_BUILD",
            toTier: "WEBSITE_LIVE",
            changedAt: daysAgo(300),
            changedById: brian.id,
          },
          {
            fromTier: "WEBSITE_LIVE",
            toTier: "BRAND_CURATION",
            changedAt: daysAgo(240),
            changedById: cole.id,
          },
          {
            fromTier: "BRAND_CURATION",
            toTier: "SOCIAL_MEDIA",
            changedAt: monthsAgo(1),
            changedById: cole.id,
          },
        ],
      },
      interactions: {
        create: [
          {
            type: "CALL",
            summary:
              "Upgraded to social management. Three posts a week plus story coverage on drop days.",
            occurredAt: monthsAgo(1),
            loggedById: cole.id,
          },
        ],
      },
    },
  });

  const pennfield = await prisma.client.create({
    data: {
      businessName: "Pennfield Pizza",
      industry: "Restaurant",
      city: "Battle Creek",
      state: "MI",
      currentTier: "WEBSITE_BUILD",
      accountOwnerId: cole.id,
      notes: "Menu photography still outstanding — blocking the build.",
      contacts: {
        create: {
          firstName: "Tony",
          lastName: "Salvatore",
          title: "Owner",
          email: "tony@pennfieldpizza.example.com",
          phone: "(269) 555-0199",
          isPrimary: true,
        },
      },
      serviceHistory: {
        create: [
          {
            fromTier: "PROSPECT",
            toTier: "WEBSITE_BUILD",
            changedAt: daysAgo(21),
            changedById: cole.id,
          },
        ],
      },
    },
  });

  await prisma.client.create({
    data: {
      businessName: "Glass Family Dental",
      industry: "Dental",
      city: "Portage",
      state: "MI",
      currentTier: "ANALYTICS",
      accountOwnerId: cole.id,
      websiteLaunchDate: daysAgo(400),
      websiteUrl: "https://glassfamilydental.example.com",
      contacts: {
        create: {
          firstName: "Erin",
          lastName: "Glass",
          title: "Practice Manager",
          email: "erin@glassfamilydental.example.com",
          phone: "(269) 555-0170",
          isPrimary: true,
        },
      },
      retainers: {
        create: {
          tier: "ANALYTICS",
          monthlyAmount: 1000,
          status: "ACTIVE",
          startDate: monthsAgo(6),
          billingDay: 1,
        },
      },
      serviceHistory: {
        create: [
          {
            fromTier: "PROSPECT",
            toTier: "WEBSITE_BUILD",
            changedAt: daysAgo(440),
            changedById: cole.id,
          },
          {
            fromTier: "WEBSITE_BUILD",
            toTier: "WEBSITE_LIVE",
            changedAt: daysAgo(400),
            changedById: brian.id,
          },
          {
            fromTier: "WEBSITE_LIVE",
            toTier: "BRAND_CURATION",
            changedAt: daysAgo(330),
            changedById: cole.id,
          },
          {
            fromTier: "BRAND_CURATION",
            toTier: "SOCIAL_MEDIA",
            changedAt: daysAgo(250),
            changedById: cole.id,
          },
          {
            fromTier: "SOCIAL_MEDIA",
            toTier: "ANALYTICS",
            changedAt: monthsAgo(6),
            changedById: cole.id,
          },
        ],
      },
      interactions: {
        create: [
          {
            type: "EMAIL",
            summary: "Sent Q2 analytics report. Bookings up 18% since launch.",
            occurredAt: daysAgo(12),
            loggedById: cole.id,
          },
        ],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        clientId: pennfield.id,
        title: "Get menu photography from Tony",
        description: "Blocking the homepage hero and the menu page.",
        type: "BUILD_MILESTONE",
        assignedToId: brian.id,
        dueDate: daysAgo(-3),
      },
      {
        clientId: pennfield.id,
        title: "Build out online ordering integration",
        type: "BUILD_MILESTONE",
        assignedToId: brian.id,
        dueDate: daysAgo(-10),
      },
    ],
  });

  await prisma.deal.createMany({
    data: [
      {
        businessName: "Marshall Auto Body",
        contactName: "Greg Marshall",
        contactEmail: "greg@marshallauto.example.com",
        contactPhone: "(269) 555-0155",
        source: "referral",
        stageId: "stage_quoted",
        estimatedValue: 3500,
        notes: "Quoted a build plus brand curation. Waiting on his partner to sign off.",
        stageChangedAt: daysAgo(6),
      },
      {
        businessName: "Lakeview Fitness",
        contactName: "Priya Nair",
        contactEmail: "priya@lakeviewfitness.example.com",
        source: "instagram DM",
        stageId: "stage_contacted",
        estimatedValue: 2800,
        stageChangedAt: daysAgo(2),
      },
      {
        businessName: "Cedar Street Barbers",
        contactName: "Owen Cole",
        source: "cold outreach",
        stageId: "stage_new",
        estimatedValue: 2200,
        stageChangedAt: daysAgo(1),
      },
    ],
  });

  return {
    usersSeeded: true,
    rulesSeeded,
    clientsSeeded: 5,
    credentials,
    message:
      credentials.length > 0
        ? `Seeded 5 clients, 3 deals and ${credentials.length} user(s). ` +
          `The generated passwords below are shown once and are not recoverable — ` +
          `save them now. Each account must set a new password on first sign-in.`
        : `Seeded 5 clients and 3 deals. Users already existed, so no passwords were ` +
          `issued or reset.`,
  };
}

/**
 * The starting pipeline columns.
 *
 * Migration 0006 already inserts these, so on a migrated database every upsert
 * is a no-op. It runs anyway because the seed has to work against a database
 * built from `prisma db push` too, where no migration ever ran.
 *
 * `update: {}` deliberately: re-seeding must never undo a rename or a reorder
 * someone has since made. Only a missing stage is created.
 */
async function seedPipelineStages(prisma: PrismaClient): Promise<void> {
  for (const stage of DEFAULT_PIPELINE_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { id: stage.id },
      update: {},
      create: {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        isWon: stage.isWon,
        isLost: stage.isLost,
      },
    });
  }
}

async function seedAutomationRules(prisma: PrismaClient): Promise<number> {
  const rules: {
    name: string;
    triggerTier: ServiceTierType | null;
    anchor: RuleAnchor;
    daysAfterTrigger: number;
    repeatEveryDays?: number;
    requiresActiveRetainer?: boolean;
    taskTitleTemplate: string;
    taskType: TaskType;
  }[] = [
    {
      name: "Pitch Brand Curation",
      triggerTier: "WEBSITE_LIVE",
      anchor: "TIER_CHANGE",
      daysAfterTrigger: 30,
      taskTitleTemplate: "Pitch brand curation package to {{businessName}}",
      taskType: "AUTO_UPSELL_PITCH",
    },
    {
      name: "Escalate Unpitched Website Client",
      triggerTier: "WEBSITE_LIVE",
      anchor: "TIER_CHANGE",
      daysAfterTrigger: 60,
      taskTitleTemplate:
        "URGENT: {{businessName}} still has no retainer 60 days post-launch — call today",
      taskType: "AUTO_UPSELL_PITCH",
    },
    {
      name: "Pitch Social Media Management",
      triggerTier: "BRAND_CURATION",
      anchor: "TIER_CHANGE",
      daysAfterTrigger: 45,
      taskTitleTemplate: "Pitch social media management to {{businessName}}",
      taskType: "AUTO_UPSELL_PITCH",
    },
    {
      name: "Pitch Analytics Package",
      triggerTier: "SOCIAL_MEDIA",
      anchor: "TIER_CHANGE",
      daysAfterTrigger: 60,
      taskTitleTemplate: "Pitch analytics package to {{businessName}}",
      taskType: "AUTO_UPSELL_PITCH",
    },
    {
      name: "Quarterly Check-in",
      triggerTier: null, // any tier
      anchor: "RETAINER_START",
      daysAfterTrigger: 90,
      repeatEveryDays: 90,
      requiresActiveRetainer: true,
      taskTitleTemplate: "Quarterly check-in call with {{businessName}}",
      taskType: "AUTO_CHECK_IN",
    },
    {
      name: "Contract Renewal Reminder",
      triggerTier: null,
      anchor: "RETAINER_END",
      daysAfterTrigger: -14, // fires 14 days before the retainer's end date
      taskTitleTemplate: "Renew contract with {{businessName}} — expires soon",
      taskType: "AUTO_CONTRACT_RENEWAL",
    },
  ];

  let created = 0;
  for (const rule of rules) {
    const existing = await prisma.automationRule.findFirst({ where: { name: rule.name } });
    if (existing) continue;
    await prisma.automationRule.create({ data: rule });
    created++;
  }
  return created;
}
