import { z } from "zod";

// Validates admin-edited configuration before it can reach the engine.
const num = z.number().finite();
const skills = z.record(z.enum(["strategy", "tech", "sales", "marketing", "ops", "finance", "product"]), num.min(0).max(10));

const effects = z.object({
  text: z.string().max(400),
  cash: num.optional(), customers: num.optional(), reputation: num.optional(), product: num.optional(), risk: num.optional(),
  arpuPct: num.optional(), churnPts: num.optional(), marginPts: num.optional(), milestones: z.array(z.string()).optional(),
});

const task = z.object({
  id: z.string().min(1).max(40), title: z.string().min(1).max(80), objective: z.string().max(300), benefits: z.string().max(300),
  category: z.enum(["research", "product", "growth", "ops", "compliance", "partnership", "finance", "recovery"]),
  kind: z.enum(["profitable", "strategic"]), cost: num.min(0), risk: z.enum(["low", "medium", "high"]), difficulty: num.min(0).max(100),
  skills, repeatable: z.boolean().optional(), acquisition: z.boolean().optional(), choiceGroup: z.string().optional(),
  turns: z.number().int().min(1).max(4).optional(),
  crew: z.array(z.string().max(40)).max(7).optional(),
  crewMax: z.number().int().min(1).max(20).optional(),
  requires: z.object({
    tasks: z.array(z.string()).optional(), milestones: z.array(z.string()).optional(), minProduct: num.optional(),
    minCustomers: num.optional(), minReputation: num.optional(), maxReputation: num.optional(), roles: z.array(z.string()).optional(),
  }).optional(),
  outcomes: z.object({ success: effects, partial: effects, failure: effects }),
});

const event = z.object({ id: z.string(), title: z.string().max(80), weight: num.min(0), effects });

export const settingsSchema = z.object({
  eventName: z.string().min(1).max(80),
  turns: z.number().int().min(1).max(60),
  equitySale: z.object({ discount: z.number().min(0).max(0.9), maxPct: z.number().min(0.01).max(0.5), minOwnership: z.number().min(0).max(0.9) }).optional(),
  startingCash: num.min(0),
  maxTeams: z.number().int().min(1).max(500),
  maxTeamSize: z.number().int().min(1).max(20),
  assignment: z.enum(["random", "balanced", "choice", "admin"]),
  allowLateJoin: z.boolean(),
  variance: num.min(0).max(40),
  eventChance: num.min(0).max(1),
  overdraft: z.boolean(),
  weights: z.object({
    valuation: num.min(0), profitability: num.min(0), traction: num.min(0), execution: num.min(0),
    efficiency: num.min(0), fundraising: num.min(0), resilience: num.min(0),
  }),
  milestoneValues: z.record(z.string(), num.min(0)),
  roles: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1).max(60), hireCost: num.min(0), salary: num.min(0),
    skills, max: z.number().int().min(0).max(20), blurb: z.string().max(300),
    icon: z.string().max(8).optional(), acquisition: z.boolean().optional(),
  })).min(1),
  rounds: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1),
    criteria: z.object({
      minProduct: num.optional(), minCustomers: num.optional(), minRevenue: num.optional(), minReputation: num.optional(),
      minLtvCac: num.optional(), milestones: z.array(z.string()).optional(), requireRoles: z.array(z.string()).optional(),
    }),
    preMoneyRange: z.tuple([num.min(0), num.min(0)]),
    dilutionRange: z.tuple([num.min(0).max(0.9), num.min(0).max(0.9)]),
    expectation: z.object({ customerMultiplier: num.min(1), withinTurns: z.number().int().min(1), penaltyReputation: num.min(0) }),
  })),
  sharedTasks: z.array(task),
  globalEvents: z.array(event),
  tracks: z.array(z.object({
    id: z.string().min(1), code: z.string().max(4), sector: z.string().max(40), problem: z.string().max(200),
    company: z.string().max(60), tagline: z.string().max(140), customerLabel: z.string().max(30),
    arpu: num.min(0), grossMargin: num.min(0).max(1), baseChurn: num.min(0).max(1), tractionTarget: num.min(1),
    tasks: z.array(task).min(1), events: z.array(event),
  })).min(1).max(8),
}).refine((s) => Object.values(s.weights).some((w) => w > 0), { message: "At least one score weight must be positive" });
