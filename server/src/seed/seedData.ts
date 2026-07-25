import type { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";
import type { RuleAnchor, ServiceTierType, TaskType } from "../domain/enums";

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
  message: string;
}

export async function runSeed(prisma: PrismaClient, env: Env): Promise<SeedResult> {
  const defaultPassword = env.SEED_PASSWORD || "changeme123";
  const passwordHash = await hashPassword(defaultPassword);

  const brian = await prisma.user.upsert({
    where: { email: "brian@midigitalexpansion.com" },
    update: {},
    create: {
      name: "Brian",
      email: "brian@midigitalexpansion.com",
      passwordHash,
      role: "TECHNICAL",
    },
  });

  const cole = await prisma.user.upsert({
    where: { email: "cole@midigitalexpansion.com" },
    update: {},
    create: {
      name: "Cole",
      email: "cole@midigitalexpansion.com",
      passwordHash,
      role: "SALES",
    },
  });

  const rulesSeeded = await seedAutomationRules(prisma);

  const existingClients = await prisma.client.count();
  if (existingClients > 0) {
    return {
      usersSeeded: true,
      rulesSeeded,
      clientsSeeded: 0,
      message: `${existingClients} client(s) already present, left client data alone.`,
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
        stage: "Quoted",
        estimatedValue: 3500,
        notes: "Quoted a build plus brand curation. Waiting on his partner to sign off.",
        stageChangedAt: daysAgo(6),
      },
      {
        businessName: "Lakeview Fitness",
        contactName: "Priya Nair",
        contactEmail: "priya@lakeviewfitness.example.com",
        source: "instagram DM",
        stage: "Contacted",
        estimatedValue: 2800,
        stageChangedAt: daysAgo(2),
      },
      {
        businessName: "Cedar Street Barbers",
        contactName: "Owen Cole",
        source: "cold outreach",
        stage: "New",
        estimatedValue: 2200,
        stageChangedAt: daysAgo(1),
      },
    ],
  });

  return {
    usersSeeded: true,
    rulesSeeded,
    clientsSeeded: 5,
    message:
      `Seeded 5 clients, 3 deals and 2 users. ` +
      `Log in as brian@midigitalexpansion.com or cole@midigitalexpansion.com ` +
      `with the seed password — change it after first login.`,
  };
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
