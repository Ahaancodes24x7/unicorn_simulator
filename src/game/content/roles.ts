import type { RoleDef } from "../types";

export const DEFAULT_ROLES: RoleDef[] = [
  { id: "ceo", icon: "👔", title: "CEO / Founder", hireCost: 200, salary: 60, max: 1, skills: { strategy: 2, sales: 0.5, finance: 0.5 },
    blurb: "Strategy, fundraising, leadership. Required to pitch Seed and later rounds." },
  { id: "engineer", icon: "💻", title: "Engineer / CTO", hireCost: 250, salary: 50, max: 4, skills: { tech: 2, product: 0.5 },
    blurb: "Builds product and infrastructure. Lowers failure risk on technical tasks." },
  { id: "sales", icon: "🤝", acquisition: true, title: "Sales / Growth", hireCost: 180, salary: 40, max: 3, skills: { sales: 2, marketing: 0.5 },
    blurb: "Leads, conversion and partnerships. Boosts customers won per task." },
  { id: "marketing", icon: "📣", acquisition: true, title: "Marketing", hireCost: 150, salary: 35, max: 2, skills: { marketing: 2, sales: 0.5 },
    blurb: "Awareness, positioning and campaigns. Amplifies acquisition." },
  { id: "ops", icon: "⚙️", title: "Operations", hireCost: 150, salary: 35, max: 2, skills: { ops: 2, finance: 0.3 },
    blurb: "Delivery and efficiency. Improves gross margin on scaling tasks." },
  { id: "finance", icon: "💵", title: "Finance", hireCost: 200, salary: 45, max: 1, skills: { finance: 2, strategy: 0.5 },
    blurb: "Runway, pricing and forecasting. Improves fundraising readiness." },
  { id: "product", icon: "🎨", title: "Product / UX", hireCost: 220, salary: 45, max: 2, skills: { product: 2, tech: 0.5 },
    blurb: "Discovery, activation and retention. Lowers churn, raises LTV." },
];

export const FIRST_NAMES = ["Ava", "Kai", "Noor", "Mateo", "Priya", "Jonah", "Lena", "Ravi", "Zoe", "Omar", "Mei", "Theo",
  "Isla", "Arjun", "Sofia", "Dev", "Hana", "Leo", "Maya", "Ezra", "Nia", "Sam", "Iris", "Felix"];
export const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVWZ";
