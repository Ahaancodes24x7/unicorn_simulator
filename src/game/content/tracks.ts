import type { CriticalEventDef, Effects, TaskDef, TrackDef } from "../types";

// Every track follows the same balanced task *graph* (so no track is easier), but has its own
// market, wording, economics and events. Customer counts are written in "units" and scaled
// by the track's `unit` so revenue opportunities are comparable across tracks.

type CoreSlot = "research" | "mvp" | "pilotLean" | "pilotPremium" | "compliance" | "growth" | "v2" | "partnership"
  | "pricing" | "scale" | "v3" | "expansion" | "global";
type BranchSlot = "landingTest" | "noCodeMvp" | "pilotCommunity" | "selfServe" | "enterpriseDeal" | "referral"
  | "aiFeature" | "brandCampaign" | "opsExcellence";
type SlotId = CoreSlot | BranchSlot;

type SlotText = { title: string; objective: string; win: string };

interface TrackSpec {
  id: string; code: string; sector: string; problem: string; company: string; tagline: string;
  customerLabel: string; arpu: number; grossMargin: number; baseChurn: number; unit: number;
  slots: Record<CoreSlot, SlotText> & Partial<Record<BranchSlot, SlotText>>;
  events: { title: string; text: string; units: number; reputation: number; cash: number; risk: number; weight: number }[];
}

interface SlotBlueprint {
  category: TaskDef["category"]; kind: TaskDef["kind"]; cost: number; risk: TaskDef["risk"]; difficulty: number;
  skills: TaskDef["skills"]; crew: string[]; crewMax?: number; requires?: TaskDef["requires"]; repeatable?: boolean; acquisition?: boolean;
  choiceGroup?: string; benefits: string;
  success: Omit<Effects, "text">; partial: Omit<Effects, "text">; failure: Omit<Effects, "text">;
  partialText: string; failureText: string;
}

// Customer numbers below are in units (u). Cash numbers are absolute.
// `crew` lists the roles a team must hire and assign to attempt the task.
const BLUEPRINT: Record<SlotId, SlotBlueprint> = {
  research: { crew: ["ceo"], choiceGroup: "discovery", category: "research", kind: "strategic", cost: 50, risk: "low", difficulty: 35,
    skills: { strategy: 1, product: 1 }, benefits: "Validates the problem. Unlocks pre-seed eligibility and sharper product bets.",
    success: { reputation: 4, milestones: ["validated"] }, partial: { reputation: 1, milestones: ["validated"] }, failure: { reputation: -2 },
    partialText: "You learned something, but the signal is noisy.", failureText: "Interviews were unfocused. No clear signal yet, so try again." },
  mvp: { crew: ["engineer"], choiceGroup: "build", category: "product", kind: "strategic", cost: 100, risk: "medium", difficulty: 45,
    skills: { tech: 3, product: 1 }, benefits: "Ships a first product. Unlocks pilots and compliance work.",
    success: { product: 1, reputation: 5, milestones: ["prototype"] }, partial: { product: 1, cash: -60, reputation: 1, milestones: ["prototype"] },
    failure: { cash: -50, reputation: -3 },
    partialText: "It works, barely. Extra fixes cost you.", failureText: "The build collapsed under its own bugs. Regroup and retry." },
  pilotLean: { crew: ["sales"], category: "growth", kind: "profitable", cost: 120, risk: "low", difficulty: 35, choiceGroup: "pilot",
    skills: { sales: 2, product: 1 }, requires: { milestones: ["prototype"] }, acquisition: true,
    benefits: "Cheap, safe pilot. Gives clean CAC data and a few paying customers. Leads to self-serve growth.",
    success: { customers: 2, cash: 150, reputation: 3, milestones: ["pilot", "path-lean"] }, partial: { customers: 1, cash: 60, milestones: ["pilot", "path-lean"] },
    failure: { reputation: -2 },
    partialText: "One cohort stuck around; the rest went quiet.", failureText: "Nobody converted. The offer needs work." },
  pilotPremium: { crew: ["ceo", "sales"], category: "growth", kind: "profitable", cost: 300, risk: "high", difficulty: 60, choiceGroup: "pilot",
    skills: { sales: 3, strategy: 1, tech: 1 }, requires: { milestones: ["prototype"] }, acquisition: true,
    benefits: "Big-ticket enterprise pilot. Larger contract and reputation upside, greater risk. Leads to enterprise deals.",
    success: { customers: 3, cash: 900, reputation: 7, milestones: ["pilot", "path-enterprise"] }, partial: { customers: 1, cash: 300, reputation: 1, milestones: ["pilot", "path-enterprise"] },
    failure: { cash: -150, reputation: -6 },
    partialText: "They signed a reduced scope. Still a logo.", failureText: "The buyer walked after procurement. Expensive lesson." },
  compliance: { crew: ["ops"], category: "compliance", kind: "strategic", cost: 200, risk: "medium", difficulty: 50,
    skills: { ops: 2, tech: 1, finance: 1 }, requires: { milestones: ["prototype"] },
    benefits: "De-risks the business. Required before partnerships; investors love it.",
    success: { risk: -15, reputation: 5, milestones: ["compliance"] }, partial: { risk: -7, cash: -80, milestones: ["compliance"] },
    failure: { risk: 5, reputation: -3 },
    partialText: "Approved with conditions; remediation cost extra.", failureText: "The audit found gaps. You need another pass." },
  growth: { crew: ["marketing"], category: "growth", kind: "profitable", cost: 300, risk: "medium", difficulty: 45, repeatable: true, acquisition: true,
    skills: { marketing: 2, sales: 2 }, requires: { milestones: ["pilot"] },
    benefits: "Repeatable acquisition push. Scales with your sales & marketing team.",
    success: { customers: 3, reputation: 2 }, partial: { customers: 1 }, failure: { reputation: -1 },
    partialText: "Clicks, but weak conversion.", failureText: "The campaign missed its audience entirely." },
  v2: { crew: ["engineer", "product"], category: "product", kind: "strategic", cost: 400, risk: "medium", difficulty: 55,
    skills: { tech: 2, product: 2 }, requires: { milestones: ["validated", "pilot"] },
    benefits: "Iterate from pilot feedback. Higher retention and product maturity.",
    success: { product: 1, churnPts: -1.5, reputation: 4, milestones: ["v2"] }, partial: { product: 1, churnPts: -0.5, milestones: ["v2"] },
    failure: { cash: -150, reputation: -2 },
    partialText: "v2 shipped with half the roadmap.", failureText: "A rushed release broke core flows. Roll back and retry." },
  partnership: { crew: ["ceo", "sales"], category: "partnership", kind: "profitable", cost: 1_500, risk: "high", difficulty: 60,
    skills: { sales: 2, strategy: 2 }, requires: { milestones: ["compliance"], minProduct: 2 }, acquisition: true,
    benefits: "Channel partnership. A large customer batch and a reputation boost, if it lands.",
    success: { customers: 10, cash: 2_500, reputation: 8, milestones: ["partnership"] }, partial: { customers: 4, reputation: 2, milestones: ["partnership"] },
    failure: { cash: -500, reputation: -6 },
    partialText: "A limited pilot with the partner, not the full rollout.", failureText: "Legal stalled the deal for good." },
  pricing: { crew: ["finance"], category: "finance", kind: "profitable", cost: 150, risk: "low", difficulty: 45,
    skills: { finance: 2, product: 1 }, requires: { minCustomers: 4 },
    benefits: "Packaging and pricing work. Permanently raises revenue per customer.",
    success: { arpuPct: 20, milestones: ["pricing"] }, partial: { arpuPct: 8, milestones: ["pricing"] }, failure: { churnPts: 1, reputation: -2 },
    partialText: "Modest uplift; some customers pushed back.", failureText: "The price hike spooked customers." },
  scale: { crew: ["engineer", "ops"], category: "ops", kind: "strategic", cost: 3_000, risk: "medium", difficulty: 55,
    skills: { ops: 2, tech: 2 }, requires: { milestones: ["v2"], minCustomers: 6 },
    benefits: "Scalable infrastructure and delivery. Better margins and product maturity.",
    success: { product: 1, marginPts: 8, risk: -8, milestones: ["scale"] }, partial: { product: 1, marginPts: 3, milestones: ["scale"] },
    failure: { cash: -1_000, risk: 6 },
    partialText: "It scales, with duct tape.", failureText: "Migration outage. Customers noticed." },
  v3: { crew: ["engineer", "product"], category: "product", kind: "strategic", cost: 8_000, risk: "medium", difficulty: 60,
    skills: { tech: 2, product: 2 }, requires: { milestones: ["scale"] },
    benefits: "Platform-level product. Major retention gains; needed for later rounds.",
    success: { product: 1, churnPts: -1.5, reputation: 6, milestones: ["v3"] }, partial: { product: 1, churnPts: -0.5, milestones: ["v3"] },
    failure: { cash: -3_000, reputation: -3 },
    partialText: "Shipped late and smaller than promised.", failureText: "The platform rewrite stalled." },
  expansion: { crew: ["sales", "marketing", "ops"], crewMax: 5, category: "growth", kind: "profitable", cost: 60_000, risk: "high", difficulty: 60, acquisition: true,
    skills: { sales: 2, marketing: 2, ops: 1 }, requires: { milestones: ["seriesA"] },
    benefits: "New regions and segments. A big customer jump; needs Series A capital.",
    success: { customers: 40, reputation: 6, product: 1, milestones: ["expansion"] }, partial: { customers: 15, milestones: ["expansion"] },
    failure: { cash: -20_000, reputation: -5 },
    partialText: "One region took off; the others lagged.", failureText: "Expansion burned cash without traction." },
  global: { crew: ["ceo", "sales", "marketing"], crewMax: 6, category: "growth", kind: "profitable", cost: 500_000, risk: "high", difficulty: 65, acquisition: true,
    skills: { sales: 2, marketing: 2, strategy: 2 }, requires: { milestones: ["seriesB", "expansion"] },
    benefits: "Category leadership push. Massive scale: the unicorn play.",
    success: { customers: 200, reputation: 10, milestones: ["global"] }, partial: { customers: 70, milestones: ["global"] },
    failure: { cash: -150_000, reputation: -8 },
    partialText: "Strong in some markets, flat in others.", failureText: "A rival out-spent you everywhere." },

  // ---- branches: each choice opens its own follow-up
  landingTest: { crew: ["marketing"], choiceGroup: "discovery", category: "research", kind: "strategic", cost: 80, risk: "low", difficulty: 40,
    skills: { marketing: 2, product: 1 }, benefits: "Validate demand with a pre-order page instead of interviews. Builds an early waitlist.",
    success: { reputation: 3, customers: 1, milestones: ["validated"] }, partial: { milestones: ["validated"] }, failure: { reputation: -1 },
    partialText: "A trickle of signups. Enough signal to keep going.", failureText: "The page got clicks but no signups. Rework the pitch." },
  noCodeMvp: { crew: ["product"], choiceGroup: "build", category: "product", kind: "strategic", cost: 60, risk: "low", difficulty: 40,
    skills: { product: 2, marketing: 1 }, benefits: "Cheaper, faster prototype with no-code tools. Less polish, so less reputation.",
    success: { product: 1, reputation: 2, milestones: ["prototype"] }, partial: { product: 1, cash: -30, milestones: ["prototype"] }, failure: { reputation: -2 },
    partialText: "It works, held together with automations.", failureText: "The tools couldn't handle your core flow. Try again or build it properly." },
  pilotCommunity: { crew: ["marketing"], choiceGroup: "pilot", category: "growth", kind: "profitable", cost: 150, risk: "low", difficulty: 40,
    skills: { marketing: 2, product: 1 }, requires: { milestones: ["prototype"] }, acquisition: true,
    benefits: "Free community beta. Fewer paying customers at first, but big reputation. Leads to a referral engine.",
    success: { customers: 1, reputation: 8, milestones: ["pilot", "path-community"] }, partial: { reputation: 3, milestones: ["pilot", "path-community"] },
    failure: { reputation: -2 },
    partialText: "A small but loyal group of fans.", failureText: "The beta launched to silence." },
  selfServe: { crew: ["engineer", "product"], category: "product", kind: "profitable", cost: 350, risk: "medium", difficulty: 50,
    skills: { product: 2, tech: 2 }, requires: { milestones: ["path-lean"] }, acquisition: true,
    benefits: "Lean path: self-serve signup and onboarding. More customers and lower churn.",
    success: { customers: 3, churnPts: -1, milestones: ["selfserve"] }, partial: { customers: 1, churnPts: -0.3, milestones: ["selfserve"] },
    failure: { cash: -100, reputation: -2 },
    partialText: "Signups work; activation still needs a human touch.", failureText: "Users got lost in onboarding." },
  enterpriseDeal: { crew: ["ceo", "sales"], category: "partnership", kind: "profitable", cost: 400, risk: "high", difficulty: 60,
    skills: { sales: 2, strategy: 2 }, requires: { milestones: ["path-enterprise"] }, acquisition: true,
    benefits: "Enterprise path: turn the pilot into an anchor contract. Big cash, big credibility.",
    success: { customers: 2, cash: 2_500, reputation: 5, milestones: ["anchor"] }, partial: { customers: 1, cash: 900, milestones: ["anchor"] },
    failure: { cash: -200, reputation: -5 },
    partialText: "They signed for one division, not the whole company.", failureText: "Procurement went with an incumbent." },
  referral: { crew: ["marketing", "product"], category: "growth", kind: "profitable", cost: 250, risk: "medium", difficulty: 45,
    skills: { marketing: 2, product: 1 }, requires: { milestones: ["path-community"] }, acquisition: true,
    benefits: "Community path: reward fans for bringing friends. Cheap, compounding growth.",
    success: { customers: 4, reputation: 3, milestones: ["referral"] }, partial: { customers: 2, milestones: ["referral"] }, failure: { reputation: -2 },
    partialText: "Some fans shared; most just liked the post.", failureText: "The rewards felt spammy." },
  aiFeature: { crew: ["engineer", "product"], choiceGroup: "moat", category: "product", kind: "strategic", cost: 1_200, risk: "medium", difficulty: 55,
    skills: { tech: 2, product: 2 }, requires: { milestones: ["v2"] },
    benefits: "Moat choice: a premium smart feature. Raises price per customer and product level.",
    success: { product: 1, arpuPct: 15, reputation: 4, milestones: ["moat"] }, partial: { arpuPct: 6, milestones: ["moat"] }, failure: { cash: -400 },
    partialText: "Useful, but customers won't pay much more for it yet.", failureText: "The model was too unreliable to ship." },
  brandCampaign: { crew: ["marketing", "sales"], choiceGroup: "moat", category: "growth", kind: "profitable", cost: 1_500, risk: "medium", difficulty: 50,
    skills: { marketing: 2, sales: 1 }, requires: { milestones: ["v2"] }, acquisition: true,
    benefits: "Moat choice: become the brand people think of first. A burst of customers and reputation.",
    success: { customers: 6, reputation: 6, milestones: ["moat"] }, partial: { customers: 3, milestones: ["moat"] }, failure: { cash: -300, reputation: -3 },
    partialText: "Good buzz, average conversion.", failureText: "The campaign missed the mark." },
  opsExcellence: { crew: ["ops", "finance"], choiceGroup: "moat", category: "ops", kind: "strategic", cost: 900, risk: "low", difficulty: 45,
    skills: { ops: 2, finance: 2 }, requires: { milestones: ["v2"] },
    benefits: "Moat choice: out-execute everyone. Permanently better margins and lower risk.",
    success: { marginPts: 6, risk: -10, milestones: ["moat"] }, partial: { marginPts: 2, risk: -4, milestones: ["moat"] }, failure: { risk: 3 },
    partialText: "Some savings stuck.", failureText: "Process changes stalled in meetings." },
};

// Track-neutral wording for branch missions; a track can override any of them in its `slots`.
const BRANCH_TEXT: Record<BranchSlot, (label: string) => SlotText> = {
  landingTest: () => ({ title: "Pre-sell with a landing page", objective: "Put up a pre-order page and run small ads to see who signs up.", win: "Hundreds join the waitlist. People want this." }),
  noCodeMvp: () => ({ title: "No-code prototype", objective: "Stitch together a working prototype with no-code tools.", win: "A scrappy prototype is live and early users love the idea." }),
  pilotCommunity: () => ({ title: "Community beta", objective: "Open a free beta and grow a community of early fans.", win: "The beta community is buzzing and the first users start paying." }),
  selfServe: (l) => ({ title: "Self-serve onboarding", objective: `Let ${l} sign up and get value without a sales call.`, win: "Signups now flow in on their own." }),
  enterpriseDeal: () => ({ title: "Anchor enterprise contract", objective: "Turn your pilot into a flagship multi-year contract.", win: "A flagship contract is signed. Other big buyers take notice." }),
  referral: (l) => ({ title: "Referral programme", objective: `Reward your community for bringing in new ${l}.`, win: "Word of mouth kicks in." }),
  aiFeature: () => ({ title: "AI-powered premium feature", objective: "Ship a smart feature customers will pay extra for.", win: "The premium feature lifts prices and wows reviewers." }),
  brandCampaign: () => ({ title: "Big brand campaign", objective: "Go big on brand: launch video, press and events.", win: "Your brand is everywhere this month." }),
  opsExcellence: () => ({ title: "Operational excellence", objective: "Tighten delivery, suppliers and finance operations.", win: "Margins up, fires out." }),
};

function buildTrack(spec: TrackSpec): TrackDef {
  const scale = (e: Omit<Effects, "text">, text: string): Effects => ({
    ...e, text, ...(e.customers ? { customers: Math.round(e.customers * spec.unit) } : {}),
  });
  const tasks: TaskDef[] = (Object.keys(BLUEPRINT) as SlotId[]).map((slot) => {
    const b = BLUEPRINT[slot];
    const t = spec.slots[slot] ?? BRANCH_TEXT[slot as BranchSlot](spec.customerLabel);
    const requires = b.requires?.minCustomers
      ? { ...b.requires, minCustomers: Math.round(b.requires.minCustomers * spec.unit) }
      : b.requires;
    return {
      id: slot, title: t.title, objective: t.objective, benefits: b.benefits, category: b.category, kind: b.kind,
      cost: b.cost, risk: b.risk, difficulty: b.difficulty, skills: b.skills, crew: b.crew, crewMax: b.crewMax, requires,
      repeatable: b.repeatable, acquisition: b.acquisition, choiceGroup: b.choiceGroup,
      outcomes: { success: scale(b.success, t.win), partial: scale(b.partial, b.partialText), failure: scale(b.failure, b.failureText) },
    };
  });
  const events: CriticalEventDef[] = spec.events.map((e, i) => ({
    id: `${spec.id}-ev${i}`, title: e.title, weight: e.weight,
    effects: {
      text: e.text,
      ...(e.units ? { customers: Math.round(e.units * spec.unit) } : {}),
      ...(e.reputation ? { reputation: e.reputation } : {}),
      ...(e.cash ? { cash: e.cash } : {}),
      ...(e.risk ? { risk: e.risk } : {}),
    },
  }));
  return {
    id: spec.id, code: spec.code, sector: spec.sector, problem: spec.problem, company: spec.company, tagline: spec.tagline,
    customerLabel: spec.customerLabel, arpu: spec.arpu, grossMargin: spec.grossMargin, baseChurn: spec.baseChurn,
    tractionTarget: Math.round(250 * spec.unit), tasks, events,
  };
}

export const DEFAULT_TRACKS: TrackDef[] = [
  buildTrack({
    id: "climate", code: "A", sector: "ClimateTech", problem: "Reduce commercial energy waste",
    company: "Watt Wise", tagline: "Smart retrofits that pay for themselves.", customerLabel: "buildings",
    arpu: 300, grossMargin: 0.55, baseChurn: 0.03, unit: 1,
    slots: {
      research: { title: "Energy audit interviews", objective: "Interview facility managers about wasted HVAC and lighting spend.", win: "Facility managers confirm it: idle HVAC is burning 30% of their budget." },
      mvp: { title: "Build sensor prototype", objective: "Ship a sensor and dashboard that spots energy waste in one building.", win: "The prototype flags a chiller running all weekend. Demo-ready!" },
      pilotLean: { title: "Low-cost office pilot", objective: "Offer a cheap 30-day pilot to small office landlords.", win: "Two landlords convert to paid plans after seeing the savings." },
      pilotPremium: { title: "Enterprise campus pilot", objective: "Pitch a premium pilot to a corporate campus.", win: "The campus signs a paid pilot with a rollout clause." },
      compliance: { title: "Grid & safety certification", objective: "Certify hardware for electrical safety and utility data-sharing.", win: "Certified. Utilities can now refer you." },
      growth: { title: "Property-manager outreach", objective: "Run outbound and webinars for property managers.", win: "The webinar was packed; several buildings onboard." },
      v2: { title: "Automated setpoint control", objective: "Let the system adjust thermostats automatically.", win: "Automation doubles customer savings; renewals lock in." },
      partnership: { title: "Utility rebate partnership", objective: "Partner with a regional utility efficiency programme.", win: "The utility bundles you into its rebate programme." },
      pricing: { title: "Savings-share pricing", objective: "Move to pricing based on a share of measured savings.", win: "Customers happily pay a cut of real savings." },
      scale: { title: "Installer network", objective: "Train certified installers so rollouts scale without your team.", win: "Installs now happen in days, not weeks." },
      v3: { title: "Portfolio optimisation AI", objective: "Optimise energy across a landlord's whole portfolio.", win: "Portfolio mode becomes the flagship feature." },
      expansion: { title: "Expand to new metros", objective: "Launch sales and installers in three new metro areas.", win: "New metros ramp faster than the home market." },
      global: { title: "Become the retrofit standard", objective: "Go national with portfolio-wide contracts.", win: "The biggest landlords standardise on Watt Wise." },
    },
    events: [
      { title: "Heatwave spikes energy prices", text: "Building owners suddenly care a lot about energy waste.", units: 2, reputation: 3, cash: 0, risk: 0, weight: 3 },
      { title: "New efficiency regulation", text: "Mandatory reporting arrives. Compliance costs rise for everyone.", units: 0, reputation: 0, cash: -200, risk: 5, weight: 2 },
      { title: "Sensor supply shortage", text: "A chip shortage delays hardware shipments.", units: 0, reputation: -4, cash: -150, risk: 4, weight: 2 },
    ],
  }),
  buildTrack({
    id: "health", code: "B", sector: "HealthTech", problem: "Improve access to preventive care",
    company: "Pulse Path", tagline: "Preventive check-ins in everyone's pocket.", customerLabel: "members",
    arpu: 12, grossMargin: 0.7, baseChurn: 0.07, unit: 25,
    slots: {
      research: { title: "Patient & clinic research", objective: "Study why people skip preventive screenings.", win: "Clear insight: scheduling friction, not cost, is the blocker." },
      mvp: { title: "Build screening reminder app", objective: "Ship an app that books screenings and sends nudges.", win: "Testers booked overdue check-ups within a week." },
      pilotLean: { title: "Community clinic pilot", objective: "Run a low-cost pilot with a community clinic.", win: "Clinic patients sign up and start paying for premium." },
      pilotPremium: { title: "Employer wellness pilot", objective: "Sell a premium wellness pilot to a large employer.", win: "The employer funds the pilot for its whole workforce." },
      compliance: { title: "Privacy & clinical review", objective: "Complete health-data privacy controls and a clinical safety review.", win: "Privacy review passed. Health systems will talk to you." },
      growth: { title: "Referral & content campaign", objective: "Launch referral rewards and health-education content.", win: "Referrals snowball through family group chats." },
      v2: { title: "Personalised care plans", objective: "Add care plans based on age, history and risk.", win: "Personalised plans boost 90-day retention sharply." },
      partnership: { title: "Health-system partnership", objective: "Integrate with a regional health system's scheduling.", win: "The health system recommends Pulse Path to patients." },
      pricing: { title: "Family plan pricing", objective: "Introduce family and employer-sponsored tiers.", win: "Family plans lift revenue per member." },
      scale: { title: "Clinical ops automation", objective: "Automate triage and appointment routing.", win: "Ops costs fall while response times improve." },
      v3: { title: "Predictive risk engine", objective: "Predict who is most at risk of missing care.", win: "Outreach now reaches high-risk members first." },
      expansion: { title: "Multi-state launch", objective: "Expand coverage and partners into new states.", win: "New-state members onboard at record pace." },
      global: { title: "National preventive network", objective: "Go national with insurers and employers.", win: "Insurers adopt Pulse Path as their preventive layer." },
    },
    events: [
      { title: "Public health campaign", text: "A national screening campaign drives sign-ups.", units: 2, reputation: 3, cash: 0, risk: 0, weight: 3 },
      { title: "Data-privacy scare in the sector", text: "A competitor's breach makes users wary of health apps.", units: 0, reputation: -5, cash: 0, risk: 6, weight: 2 },
      { title: "Insurer coverage change", text: "Reimbursement rules shift; you absorb transition costs.", units: 0, reputation: 0, cash: -150, risk: 3, weight: 2 },
    ],
  }),
  buildTrack({
    id: "fintech", code: "C", sector: "FinTech", problem: "Make payments safer and simpler",
    company: "Clear Ledger", tagline: "Payments small businesses can trust.", customerLabel: "merchants",
    arpu: 8, grossMargin: 0.65, baseChurn: 0.06, unit: 37,
    slots: {
      research: { title: "Merchant pain-point study", objective: "Study fraud losses and checkout friction at small merchants.", win: "Merchants lose more to chargebacks than to fees. Big insight." },
      mvp: { title: "Build secure checkout MVP", objective: "Ship a checkout with built-in fraud scoring.", win: "Checkout blocks fraud in testing without adding friction." },
      pilotLean: { title: "Self-serve merchant beta", objective: "Open a low-cost self-serve beta for small shops.", win: "Shops onboard themselves and start processing." },
      pilotPremium: { title: "Marketplace platform pilot", objective: "Pilot as the payment rail for an online marketplace.", win: "The marketplace routes its sellers through you." },
      compliance: { title: "Card security & KYC controls", objective: "Pass card-security and know-your-customer audits.", win: "Audits passed. Banks now take your calls." },
      growth: { title: "Merchant onboarding drive", objective: "Run partner referrals and onboarding incentives.", win: "Onboarding time drops; merchants flood in." },
      v2: { title: "Instant payouts & disputes", objective: "Add instant payouts and one-click dispute handling.", win: "Merchants rave about same-day payouts." },
      partnership: { title: "Bank & POS integration", objective: "Integrate with a regional bank and popular point-of-sale systems.", win: "The bank offers Clear Ledger to its business customers." },
      pricing: { title: "Tiered pricing & add-ons", objective: "Launch tiered plans and paid risk-protection add-ons.", win: "Risk protection becomes a top-selling add-on." },
      scale: { title: "Real-time risk infrastructure", objective: "Rebuild risk scoring for millions of transactions.", win: "Latency halves while the fraud catch-rate rises." },
      v3: { title: "Embedded finance platform", objective: "Offer invoicing and working-capital tools.", win: "Merchants now run their whole back office on you." },
      expansion: { title: "Cross-border payments", objective: "Support new currencies and regions.", win: "Cross-border volume grows month over month." },
      global: { title: "Become the trusted rail", objective: "Win national platforms and acquirers.", win: "Clear Ledger becomes the default trusted rail." },
    },
    events: [
      { title: "Fraud wave hits competitors", text: "Merchants flee less secure processors, straight to you.", units: 2, reputation: 4, cash: 0, risk: 0, weight: 3 },
      { title: "Regulator tightens rules", text: "New payment rules require costly changes.", units: 0, reputation: 0, cash: -200, risk: 5, weight: 2 },
      { title: "Processing partner outage", text: "An upstream outage hits your merchants.", units: 0, reputation: -5, cash: -100, risk: 3, weight: 2 },
    ],
  }),
  buildTrack({
    id: "edtech", code: "D", sector: "EdTech / AI", problem: "Improve learning outcomes",
    company: "Learn Loop", tagline: "An AI tutor that adapts to every student.", customerLabel: "learners",
    arpu: 10, grossMargin: 0.75, baseChurn: 0.08, unit: 30,
    slots: {
      research: { title: "Classroom observation study", objective: "Sit in classrooms and interview teachers and students.", win: "Teachers need help with personalised practice, not more content." },
      mvp: { title: "Build adaptive tutor MVP", objective: "Ship a tutor that adapts practice to each student.", win: "Students in testing improved quiz scores within a week." },
      pilotLean: { title: "Low-cost classroom pilot", objective: "Offer a low-cost pilot to a handful of teachers.", win: "Teachers convert their classes to paid seats." },
      pilotPremium: { title: "District-wide pilot", objective: "Pitch a premium pilot to a school district.", win: "The district funds a paid multi-school pilot." },
      compliance: { title: "Student privacy & safety", objective: "Complete student-data privacy and AI safety reviews.", win: "Approved. Districts can now procure you." },
      growth: { title: "Teacher ambassador programme", objective: "Recruit teachers to champion the product.", win: "Ambassadors spread the word staff-room by staff-room." },
      v2: { title: "Progress dashboards", objective: "Give teachers and parents mastery dashboards.", win: "Parents love the progress reports; retention climbs." },
      partnership: { title: "Curriculum publisher deal", objective: "Bundle with a major curriculum publisher.", win: "The publisher ships Learn Loop with its textbooks." },
      pricing: { title: "School & family tiers", objective: "Introduce school licences and family plans.", win: "Licences lift revenue per learner." },
      scale: { title: "Model cost optimisation", objective: "Cut AI inference costs and improve uptime.", win: "Inference costs drop sharply at scale." },
      v3: { title: "Teacher co-pilot", objective: "Help teachers plan lessons and grade with AI.", win: "The teacher co-pilot becomes the reason districts renew." },
      expansion: { title: "New states & languages", objective: "Localise and expand into new regions.", win: "Localised versions take off in new regions." },
      global: { title: "Learning platform of record", objective: "Win statewide and international contracts.", win: "Learn Loop becomes a platform of record." },
    },
    events: [
      { title: "Exam season surge", text: "Exam pressure sends families looking for tutoring.", units: 2, reputation: 2, cash: 0, risk: 0, weight: 3 },
      { title: "AI-in-schools backlash", text: "A viral story about AI cheating worries parents.", units: 0, reputation: -5, cash: 0, risk: 5, weight: 2 },
      { title: "District budget freeze", text: "District budgets freeze; procurement slows.", units: 0, reputation: 0, cash: -120, risk: 3, weight: 2 },
    ],
  }),
];
