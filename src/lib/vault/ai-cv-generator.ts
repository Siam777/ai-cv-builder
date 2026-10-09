import {
  type ResumeDocument,
  type Entry,
  type SectionType,
  createDocument,
  newEntry,
  uid,
} from "../document";
import { ROLE_BENCHMARKS } from "../linter/role-analyzer";

export interface AiCvGenerationParams {
  name: string;
  roleId: string;
  roleTitle?: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "executive";
  keySkills: string[];
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export function generateAiResume(params: AiCvGenerationParams): ResumeDocument {
  const roleBench = ROLE_BENCHMARKS[params.roleId] || ROLE_BENCHMARKS["software-engineer"];
  const targetTitle = params.roleTitle || roleBench.title;
  const name = params.name.trim() || "Alex Mercer";
  const email = params.email?.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
  const location = params.location?.trim() || "San Francisco, CA";
  const phone = params.phone?.trim() || "+1 (555) 382-9104";
  const website = params.website?.trim() || `linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "")}`;
  const industry = params.industry?.trim() || "High-Growth SaaS & Distributed Systems";

  // Build Seniority-tailored Headline
  const seniorityPrefix =
    params.seniority === "junior"
      ? "Associate"
      : params.seniority === "mid"
      ? ""
      : params.seniority === "senior"
      ? "Senior"
      : params.seniority === "lead"
      ? "Lead / Staff"
      : "Principal / VP of";

  const fullHeadline = [seniorityPrefix, targetTitle].filter(Boolean).join(" ");

  // Create base document
  const doc = createDocument(false);
  doc.name = `${name} - ${targetTitle}`;
  doc.contact = {
    name,
    headline: fullHeadline,
    location,
    email,
    phone,
    website,
  };

  const skillsList =
    params.keySkills.length > 0
      ? params.keySkills.slice(0, 5).join(", ")
      : roleBench.coreCompetencies.slice(0, 4).join(", ");
  const summaryText = buildSummary(name, fullHeadline, params.seniority, industry, skillsList);

  const addEntry = (type: SectionType, fields: Partial<Entry>) => {
    const sec = doc.sections.find((s) => s.type === type);
    if (sec) {
      sec.entries.push({
        ...newEntry(),
        ...fields,
      });
    }
  };

  // 1. Summary
  addEntry("summary", {
    description: summaryText,
  });

  // 2. Experience
  const expList = buildExperienceEntries(targetTitle, params.seniority, params.keySkills, industry);
  for (const exp of expList) {
    addEntry("experience", exp);
  }

  // 3. Skills
  const coreCompetencies = roleBench.coreCompetencies;
  const mergedCore = Array.from(new Set([...params.keySkills, ...coreCompetencies]));
  const midIdx = Math.ceil(mergedCore.length / 2);
  addEntry("skills", {
    title: "Core Competencies & Tools",
    description: mergedCore.slice(0, midIdx).join(" · "),
  });
  addEntry("skills", {
    title: "Architecture & Frameworks",
    description: Array.from(new Set([...mergedCore.slice(midIdx), ...roleBench.recommendedKeywords])).join(" · "),
  });

  // 4. Projects
  const proj = buildProject(targetTitle, params.keySkills);
  addEntry("projects", proj);

  // 5. Education
  addEntry("education", {
    title:
      params.roleId === "business-analyst"
        ? "B.S. in Business Information Systems"
        : params.roleId === "product-designer"
        ? "B.F.A. in Interaction Design & HCI"
        : params.roleId === "marketing-lead"
        ? "B.A. in Marketing & Digital Communication"
        : "B.S. in Computer Science & Engineering",
    organization: "State University of California",
    location: "California, USA",
    start: "2016",
    end: "2020",
    description: "Graduated Magna Cum Laude · Coursework: Distributed Systems, Database Optimization, Algorithms",
  });

  return doc;
}

function buildSummary(
  name: string,
  headline: string,
  seniority: string,
  industry: string,
  skills: string,
): string {
  const years =
    seniority === "junior"
      ? "2+ years"
      : seniority === "mid"
      ? "4+ years"
      : seniority === "senior"
      ? "7+ years"
      : "10+ years";

  return `${headline} with ${years} of track record delivering high-impact initiatives across ${industry}. Expert in ${skills}, specializing in building resilient, scalable systems, optimizing operational workflows, and driving quantifiable product outcomes. Proven ability to translate complex stakeholder requirements into production-ready solutions while maintaining rigorous standards for performance, security, and uptime.`;
}

function buildExperienceEntries(
  title: string,
  seniority: string,
  skills: string[],
  industry: string,
): Partial<Entry>[] {
  const primarySkill = skills[0] || "TypeScript";
  const secSkill = skills[1] || "Cloud Microservices";

  if (title.toLowerCase().includes("architect")) {
    return [
      {
        title: "Staff Solutions Architect",
        organization: "Apex Enterprise Cloud",
        location: "San Francisco, CA",
        start: "2022-01",
        current: true,
        bullets: [
          {
            id: uid(),
            text: "Spearheaded architectural transition from legacy monolithic codebase to event-driven microservices on AWS, reducing mean service latency by 54% across 18 core services.",
          },
          {
            id: uid(),
            text: "Engineered multi-region failover cluster handling 22M daily requests with guaranteed 99.995% uptime SLA, surviving 3 major cloud availability zone outages with zero data loss.",
          },
          {
            id: uid(),
            text: "Standardized enterprise cloud infrastructure using Terraform and Kubernetes, cutting annual AWS infrastructure spend by $210,000 (32% net cost reduction).",
          },
          {
            id: uid(),
            text: "Authored 16 Architecture Decision Records (ADRs) and led cross-functional technical governance councils across 45+ distributed engineers.",
          },
        ],
      },
      {
        title: "Lead Systems Architect",
        organization: "Vanguard Tech Systems",
        location: "Austin, TX",
        start: "2018-05",
        end: "2021-12",
        current: false,
        bullets: [
          {
            id: uid(),
            text: "Designed high-throughput data streaming platform leveraging Kafka and Redis, supporting 140,000 transactions/second at sub-20ms P99 latency.",
          },
          {
            id: uid(),
            text: "Implemented zero-trust security perimeter and automated compliance audit policies, accelerating SOC2 Type II certification by 3 months.",
          },
          {
            id: uid(),
            text: "Mentored 12 senior engineers in distributed system patterns, domain-driven design (DDD), and observability best practices.",
          },
        ],
      },
    ];
  }

  if (title.toLowerCase().includes("analyst")) {
    return [
      {
        title: "Senior Business Analyst",
        organization: "Beacon Financial & Digital",
        location: "New York, NY",
        start: "2022-03",
        current: true,
        bullets: [
          {
            id: uid(),
            text: "Partnered with executive leadership to author comprehensive BRDs, functional specs, and 120+ user stories for flagship digital transformation project.",
          },
          {
            id: uid(),
            text: "Streamlined vendor procurement and invoicing workflows using BPMN process re-engineering, slashing cycle turnaround time from 16 days to 3.5 days (78% efficiency gain).",
          },
          {
            id: uid(),
            text: "Conducted quantitative gap analysis across 4 operational units, discovering redundant software licensing and delivering $185,000 in recurring annual savings.",
          },
          {
            id: uid(),
            text: "Facilitated structured UAT across 6 business divisions, securing 98.4% first-round stakeholder sign-off with zero high-severity production defects.",
          },
        ],
      },
      {
        title: "Business Systems Analyst",
        organization: "Clarion Operations Group",
        location: "Chicago, IL",
        start: "2019-01",
        end: "2022-02",
        current: false,
        bullets: [
          {
            id: uid(),
            text: "Designed interactive Power BI and Tableau dashboards tracking real-time KPIs, improving leadership decision turnaround time by 40%.",
          },
          {
            id: uid(),
            text: "Facilitated bi-weekly sprint backlog grooming and stakeholder alignment sessions, increasing sprint commitment completion rate from 72% to 94%.",
          },
          {
            id: uid(),
            text: "Standardized requirements elicitation templates in Confluence, decreasing onboarding ramp-up for incoming analysts by 50%.",
          },
        ],
      },
    ];
  }

  if (title.toLowerCase().includes("design")) {
    return [
      {
        title: seniority === "senior" || seniority === "lead" ? `Senior ${title}` : title,
        organization: "Prism Interactive Design",
        location: "San Francisco, CA",
        start: "2021-06",
        current: true,
        bullets: [
          {
            id: uid(),
            text: "Spearheaded design system overhaul in Figma, building 140+ accessible UI components adopted across 6 mobile and web surfaces.",
          },
          {
            id: uid(),
            text: "Conducted 36 usability testing sessions, reducing user drop-off by 34% and cutting onboarding friction points.",
          },
          {
            id: uid(),
            text: "Redesigned mobile checkout flow, lifting user conversion by 26% and decreasing subscription churn by 14%.",
          },
          {
            id: uid(),
            text: "Partnered with engineers to guarantee 100% WCAG 2.1 AA accessibility compliance across all customer-facing surfaces.",
          },
        ],
      },
      {
        title: `Product Designer II`,
        organization: "Lumina Labs",
        location: "Seattle, WA",
        start: "2018-08",
        end: "2021-05",
        current: false,
        bullets: [
          {
            id: uid(),
            text: "Built interactive high-fidelity prototypes and mapped user journeys, accelerating feature validation and stakeholder sign-off by 45%.",
          },
          {
            id: uid(),
            text: "Designed conversion-optimized landing pages and design tokens, boosting signup completion by 22%.",
          },
        ],
      },
    ];
  }

  if (title.toLowerCase().includes("market") || title.toLowerCase().includes("growth")) {
    return [
      {
        title: seniority === "senior" || seniority === "lead" ? `Senior ${title}` : title,
        organization: "Verve Growth Media",
        location: "Austin, TX",
        start: "2021-04",
        current: true,
        bullets: [
          {
            id: uid(),
            text: "Managed $550,000 annual performance advertising budget across Google and LinkedIn with sustained 4.4x Return on Ad Spend (ROAS).",
          },
          {
            id: uid(),
            text: "Executed technical SEO and keyword strategy, achieving #1 organic ranking for 42 high-intent keywords and 220k monthly visits.",
          },
          {
            id: uid(),
            text: "Designed 18 conversion-focused landing pages, lifting visitor-to-demo conversion from 2.8% to 6.4% and adding $1.8M in pipeline value.",
          },
          {
            id: uid(),
            text: "Constructed attribution tracking dashboards in Google Analytics 4 and Looker Studio to optimize customer acquisition journeys.",
          },
        ],
      },
      {
        title: "Growth Marketing Specialist",
        organization: "Nexus Digital",
        location: "Austin, TX",
        start: "2018-09",
        end: "2021-03",
        current: false,
        bullets: [
          {
            id: uid(),
            text: "Built automated email nurture sequences in HubSpot with behavioral triggers, increasing trial-to-paid conversion by 31%.",
          },
          {
            id: uid(),
            text: "Conducted continuous A/B multivariate tests across ad creatives, cutting customer acquisition cost (CAC) by 28%.",
          },
        ],
      },
    ];
  }

  // Default Software Engineer / Programmer / Developer
  return [
    {
      title: seniority === "senior" || seniority === "lead" ? `Senior ${title}` : title,
      organization: "Nexus Cloud Solutions",
      location: "San Francisco, CA",
      start: "2021-06",
      current: true,
      bullets: [
        {
          id: uid(),
          text: `Architected high-scale web applications and APIs using ${primarySkill} and ${secSkill}, supporting 850,000 monthly active users with 99.98% availability.`,
        },
        {
          id: uid(),
          text: "Optimized critical database queries and introduced Redis caching layers, driving a 62% reduction in P99 API response times (from 420ms to 160ms).",
        },
        {
          id: uid(),
          text: "Engineered automated CI/CD deployment pipelines with comprehensive unit and integration test coverage, boosting team deployment frequency from weekly to daily.",
        },
        {
          id: uid(),
          text: "Mentored 5 junior engineers and spearheaded automated testing, boosting test coverage from 64% to 92% across core services.",
        },
        {
          id: uid(),
          text: "Refactored core authentication and payment checkout flows, eliminating duplicate webhook events and reducing customer drop-off rate by 18%.",
        },
      ],
    },
    {
      title: `${title} II`,
      organization: "Quantum Interactive",
      location: "San Jose, CA",
      start: "2018-08",
      end: "2021-05",
      current: false,
      bullets: [
        {
          id: uid(),
          text: "Built modular, accessible UI design system components adopted by 5 product teams, reducing frontend development turnaround time by 35%.",
        },
        {
          id: uid(),
          text: "Identified and resolved 32 persistent memory leaks and frontend performance bottlenecks, improving Google Lighthouse performance score from 68 to 96.",
        },
        {
          id: uid(),
          text: "Collaborated in Agile sprints with product designers and backend engineers, delivering 14 major feature milestones on schedule.",
        },
      ],
    },
  ];
}

function buildProject(title: string, skills: string[]): Partial<Entry> {
  const mainTech = skills[0] || "TypeScript";
  const subTech = skills[1] || "PostgreSQL";

  if (title.toLowerCase().includes("design")) {
    return {
      title: "Aurora Design System & Token Architecture",
      organization: "Open Source Creator",
      location: "Figma & GitHub",
      start: "2023",
      current: true,
      description: `Cross-platform tokenized component library built in ${mainTech} with 4,500+ community stars.`,
      bullets: [
        {
          id: uid(),
          text: "Integrated automated WCAG contrast auditing and design token export pipelines for web and mobile platforms.",
        },
      ],
    };
  }

  if (title.toLowerCase().includes("market") || title.toLowerCase().includes("growth")) {
    return {
      title: "B2B SaaS Growth & CRO Acquisition Funnel",
      organization: "GrowthLab Open Project",
      location: "Austin, TX",
      start: "2023",
      current: true,
      description: `High-converting interactive lead engine powered by ${mainTech} and ${subTech}.`,
      bullets: [
        {
          id: uid(),
          text: "Engineered multi-touch customer journey attribution model delivering 3.8x lift in demo-to-paid conversion.",
        },
      ],
    };
  }

  return {
    title: "Real-Time Observability & Analytics Platform",
    organization: "Open Source Initiative",
    location: "GitHub",
    start: "2023",
    current: true,
    description: `Telemetry processing engine built with ${mainTech} and ${subTech}, processing 50k events/sec.`,
    bullets: [
      {
        id: uid(),
        text: "Implemented end-to-end telemetry encryption, automated schema migrations, and Dockerized one-command local developer environment.",
      },
    ],
  };
}
