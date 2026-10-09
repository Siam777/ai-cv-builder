import {
  type ResumeDocument,
  type SectionType,
  type Entry,
  createDocument,
  uid,
} from "./document";
import { type Presentation } from "./presentation";

export interface DemoResumeMeta {
  id: string;
  name: string;
  role: string;
  category: "tech" | "design" | "business" | "executive" | "marketing";
  headline: string;
  recommendedTemplate: Presentation["template"];
  recommendedAccent: Presentation["accent"];
  summaryPreview: string;
  hasPhoto: boolean;
  create: () => ResumeDocument;
}

export const DEMO_PROFILES: DemoResumeMeta[] = [
  {
    id: "siam-riaz",
    name: "Siam Riaz",
    role: "Senior Full Stack Engineer",
    category: "tech",
    headline: "Senior Full Stack Engineer & Cloud Architect",
    recommendedTemplate: "tech",
    recommendedAccent: "charcoal",
    summaryPreview:
      "7+ years architecting high-throughput distributed web systems, Next.js, and cloud platforms.",
    hasPhoto: true,
    create: createSiamRiazResume,
  },
  {
    id: "lorna-alvarado",
    name: "Lorna Alvarado",
    role: "Lead Product & UX Designer",
    category: "design",
    headline: "Lead Product & Interaction Designer",
    recommendedTemplate: "creative",
    recommendedAccent: "navy",
    summaryPreview:
      "Human-centered product design, multi-platform Figma design systems, and conversion-optimized UX.",
    hasPhoto: true,
    create: createLornaAlvaradoResume,
  },
  {
    id: "richard-sanchez",
    name: "Richard Sanchez",
    role: "Principal Solutions Architect",
    category: "executive",
    headline: "Principal Cloud Solutions Architect & VP Engineering",
    recommendedTemplate: "timeline",
    recommendedAccent: "navy",
    summaryPreview:
      "Enterprise cloud infrastructure, zero-trust security, Kubernetes microservices, and 40+ engineer org leadership.",
    hasPhoto: true,
    create: createRichardSanchezResume,
  },
  {
    id: "sarah-jenkins",
    name: "Sarah Jenkins",
    role: "Senior Business Analyst",
    category: "business",
    headline: "Senior Business Analyst & Operations Lead",
    recommendedTemplate: "modern",
    recommendedAccent: "plum",
    summaryPreview:
      "Financial process optimization, SQL data pipelines, BPMN mapping, and executive Tableau reporting.",
    hasPhoto: false,
    create: createSarahJenkinsResume,
  },
  {
    id: "sharya-singh",
    name: "Sharya Singh",
    role: "Digital Growth & Web Lead",
    category: "marketing",
    headline: "Digital Growth & Web Marketing Lead",
    recommendedTemplate: "minimalist",
    recommendedAccent: "charcoal",
    summaryPreview:
      "Performance marketing, technical SEO, high-converting landing pages, and B2B SaaS acquisition.",
    hasPhoto: true,
    create: createSharyaSinghResume,
  },
];

// Reusable SVG Avatar Portraits
const TECH_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231e293b'/><circle cx='50' cy='38' r='20' fill='%23e2e8f0'/><path d='M20,86 C20,68 35,62 50,62 C65,62 80,68 80,86 Z' fill='%23e2e8f0'/><circle cx='50' cy='38' r='14' fill='%23cbd5e1'/><rect x='42' y='36' width='16' height='4' rx='2' fill='%230f172a'/></svg>";

const DESIGN_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231B365D'/><circle cx='50' cy='36' r='20' fill='%23fef08a'/><path d='M22,86 C22,66 36,60 50,60 C64,60 78,66 78,86 Z' fill='%23f8fafc'/><circle cx='50' cy='36' r='14' fill='%23fed7aa'/><path d='M35,28 C38,18 62,18 65,28 C65,34 60,34 50,34 C40,34 35,34 35,28 Z' fill='%23451a03'/></svg>";

const ARCHITECT_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230f172a'/><circle cx='50' cy='36' r='20' fill='%23fdba74'/><path d='M22,86 C22,68 35,62 50,62 C65,62 78,68 78,86 Z' fill='%23334155'/><circle cx='50' cy='36' r='14' fill='%23fed7aa'/><path d='M36,26 C40,20 60,20 64,26 C64,30 36,30 36,26 Z' fill='%231c1917'/></svg>";

const MARKETING_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23334155'/><circle cx='50' cy='36' r='20' fill='%23fde047'/><path d='M22,86 C22,66 36,60 50,60 C64,60 78,66 78,86 Z' fill='%23f1f5f9'/><circle cx='50' cy='36' r='14' fill='%23fcd34d'/></svg>";

function helperAdd(doc: ResumeDocument, type: SectionType, fields: Partial<Entry>) {
  const section = doc.sections.find((s) => s.type === type);
  if (section) {
    section.entries.push({
      id: uid(),
      title: "",
      organization: "",
      location: "",
      start: "",
      end: "",
      current: false,
      description: "",
      bullets: [],
      ...fields,
    });
  }
}

export function createSiamRiazResume(): ResumeDocument {
  const doc = createDocument(false);
  doc.name = "Siam Riaz — Senior Full Stack Engineer";
  doc.contact = {
    name: "Siam Riaz",
    headline: "Senior Full Stack Engineer & Cloud Architect",
    email: "siamriazcr777@gmail.com",
    phone: "+880 1774-356269",
    location: "Dhaka, Bangladesh",
    website: "elfasyssolution.com",
    photoUrl: TECH_AVATAR_SVG,
  };
  doc.presentation = {
    ...doc.presentation,
    template: "tech",
    accent: "charcoal",
    font: "sans",
    fontSize: 10,
    density: "balanced",
    showPhoto: true,
  };

  helperAdd(doc, "summary", {
    description:
      "Results-driven Senior Full Stack Engineer with 7+ years of expertise architecting high-throughput distributed web systems, real-time SaaS applications, and cloud-native microservices. Proven track record reducing API latencies by 86% and supporting platforms with 1.2M+ active users.",
  });

  helperAdd(doc, "experience", {
    title: "Lead Full Stack Engineer",
    organization: "Synesis IT Ltd",
    location: "Karwan Bazar, Dhaka",
    start: "2021-02",
    current: true,
    bullets: [
      {
        id: uid(),
        text: "Architected enterprise multi-tenant SaaS platform using Next.js 14, Node.js, and PostgreSQL, scaling throughput to 25,000+ requests/minute with zero downtime.",
      },
      {
        id: uid(),
        text: "Engineered distributed Redis caching strategy and database query indexing, slashing core API response times from 340ms to 48ms (86% reduction).",
      },
      {
        id: uid(),
        text: "Led an agile engineering squad of 8 developers through sprint planning, code reviews, and CI/CD automation, accelerating release velocity by 35%.",
      },
      {
        id: uid(),
        text: "Integrated secure OAuth 2.0 authentication, role-based access control (RBAC), and Stripe billing engine, capturing $185,000 in monthly subscription revenue.",
      },
    ],
  });

  helperAdd(doc, "experience", {
    title: "Senior Software Engineer",
    organization: "Elfasys Solutions",
    location: "Dhaka, Bangladesh",
    start: "2018-06",
    end: "2021-01",
    bullets: [
      {
        id: uid(),
        text: "Developed responsive customer portals with React, TypeScript, Redux Toolkit, and Tailwind CSS, improving Google Core Web Vitals score from 68 to 96.",
      },
      {
        id: uid(),
        text: "Containerized 14 backend microservices using Docker and Kubernetes clusters on AWS (ECS, RDS, S3), reducing monthly cloud infrastructure costs by $3,200.",
      },
      {
        id: uid(),
        text: "Authored automated end-to-end and integration test suites with Playwright and Jest, increasing production test coverage from 42% to 91%.",
      },
    ],
  });

  helperAdd(doc, "education", {
    title: "B.Sc. in Computer Science & Engineering",
    organization: "CUET (Chittagong University of Engineering & Technology)",
    location: "Chittagong, Bangladesh",
    start: "2014",
    end: "2018",
  });

  helperAdd(doc, "skills", {
    title: "Frontend Engineering",
    description:
      "React · Next.js · TypeScript · Tailwind CSS · Vue.js · Redux Toolkit · Webpack · Vite",
  });
  helperAdd(doc, "skills", {
    title: "Backend & Cloud",
    description:
      "Node.js · Go · PostgreSQL · Redis · Docker · Kubernetes · AWS (ECS, S3, RDS) · GraphQL · REST APIs",
  });
  helperAdd(doc, "skills", {
    title: "Architecture & DevOps",
    description:
      "Microservices · System Design · CI/CD (GitHub Actions) · Jest · Playwright · Git · Agile / Scrum",
  });

  helperAdd(doc, "projects", {
    title: "Posttrick — Multi-Platform Social Media Automation",
    organization: "Lead Architect & Creator",
    description:
      "Automated scheduling and analytics engine integrating Graph API, LinkedIn, and X APIs with 15,000+ active scheduled posts monthly.",
  });
  helperAdd(doc, "projects", {
    title: "CloudMetrics — Distributed Observability Engine",
    organization: "Open Source Contributor",
    description:
      "High-throughput real-time log ingestion and monitoring dashboard built with Go, ClickHouse, and WebSocket streaming.",
  });

  helperAdd(doc, "languages", {
    title: "Languages",
    description: "English (Professional Working) · Bengali (Native)",
  });

  return doc;
}

export function createLornaAlvaradoResume(): ResumeDocument {
  const doc = createDocument(false);
  doc.name = "Lorna Alvarado — Lead Product Designer";
  doc.contact = {
    name: "Lorna Alvarado",
    headline: "Lead Product & Interaction Designer",
    email: "lorna.alvarado@example.com",
    phone: "+1 (555) 456-7890",
    location: "San Francisco, CA",
    website: "lorna-design.io",
    photoUrl: DESIGN_AVATAR_SVG,
  };
  doc.presentation = {
    ...doc.presentation,
    template: "creative",
    accent: "navy",
    font: "sans",
    fontSize: 10,
    density: "balanced",
    showPhoto: true,
  };

  helperAdd(doc, "summary", {
    description:
      "Senior Product Designer with 6+ years creating human-centered digital experiences for fast-growing SaaS and enterprise platforms. Recognized for bridging design systems and engineering velocity, improving onboarding conversion by 38% for 450,000 active users.",
  });

  helperAdd(doc, "experience", {
    title: "Lead Product Designer",
    organization: "Arowwai Industries",
    location: "San Francisco, CA",
    start: "2021-03",
    current: true,
    bullets: [
      {
        id: uid(),
        text: "Spearheaded end-to-end design of collaborative team workspace, elevating task completion rate from 64% to 92% across 320,000 monthly users.",
      },
      {
        id: uid(),
        text: "Architected multi-brand design system in Figma adopted across 12 product engineering squads, accelerating cross-platform UI delivery by 40%.",
      },
      {
        id: uid(),
        text: "Conducted 65+ moderated usability interviews and quantitative telemetry audits, aligning C-suite roadmap initiatives with verified user pain points.",
      },
    ],
  });

  helperAdd(doc, "experience", {
    title: "Senior UX/UI Designer",
    organization: "Borcelle Studio",
    location: "New York, NY",
    start: "2018-05",
    end: "2021-02",
    bullets: [
      {
        id: uid(),
        text: "Redesigned mobile checkout and subscription onboarding flow, lifting user conversion by 26% and decreasing churn by 14%.",
      },
      {
        id: uid(),
        text: "Partnered with frontend engineers to guarantee 100% WCAG 2.1 AA accessibility compliance across all production web surfaces.",
      },
    ],
  });

  helperAdd(doc, "education", {
    title: "Master of Human-Computer Interaction",
    organization: "Stanford University",
    location: "Stanford, CA",
    start: "2016",
    end: "2018",
  });
  helperAdd(doc, "education", {
    title: "B.F.A. in Communication Design",
    organization: "Rhode Island School of Design (RISD)",
    location: "Providence, RI",
    start: "2012",
    end: "2016",
  });

  helperAdd(doc, "skills", {
    title: "Product Design",
    description:
      "Design Systems · Figma · Interactive Prototyping · Information Architecture · Wireframing · Mobile UX",
  });
  helperAdd(doc, "skills", {
    title: "User Research & Strategy",
    description:
      "Usability Testing · User Journey Mapping · Persona Synthesis · A/B Experimentation · Data-Informed Design",
  });
  helperAdd(doc, "skills", {
    title: "Technical & Tools",
    description:
      "HTML5 / CSS3 · Design Tokens · Framer · Storybook · WCAG 2.1 Accessibility · Miro",
  });

  helperAdd(doc, "projects", {
    title: "Aurora Design System",
    organization: "Open Source Creator",
    description:
      "Accessible multi-platform component library with tokenized themes and 4,500+ GitHub community stars.",
  });

  helperAdd(doc, "languages", {
    title: "Languages",
    description: "English (Native) · Spanish (Fluent)",
  });

  return doc;
}

export function createRichardSanchezResume(): ResumeDocument {
  const doc = createDocument(false);
  doc.name = "Richard Sanchez — Solutions Architect";
  doc.contact = {
    name: "Richard Sanchez",
    headline: "Principal Cloud Solutions Architect & Engineering Leader",
    email: "richard.sanchez@example.com",
    phone: "+1 (555) 345-6789",
    location: "Seattle, WA",
    website: "richardsanchez.cloud",
    photoUrl: ARCHITECT_AVATAR_SVG,
  };
  doc.presentation = {
    ...doc.presentation,
    template: "timeline",
    accent: "navy",
    font: "sans",
    fontSize: 10,
    density: "balanced",
    showPhoto: true,
  };

  helperAdd(doc, "summary", {
    description:
      "Visionary Principal Solutions Architect with 10+ years directing large-scale cloud infrastructure, zero-trust security postures, and enterprise microservices transformations. Successfully executed zero-downtime migrations saving $2.4M in AWS compute overhead while maintaining 99.995% availability.",
  });

  helperAdd(doc, "experience", {
    title: "Principal Cloud Architect",
    organization: "Wardiere Cloud Systems",
    location: "Seattle, WA",
    start: "2020-04",
    current: true,
    bullets: [
      {
        id: uid(),
        text: "Architected enterprise cloud migration of monolithic banking core to Kubernetes microservices on AWS, achieving zero service disruption for 18M customers.",
      },
      {
        id: uid(),
        text: "Formulated multi-region active-active disaster recovery framework, reducing Recovery Time Objective (RTO) from 4 hours to 45 seconds and RPO to zero.",
      },
      {
        id: uid(),
        text: "Established FinOps cloud governance protocols, slashing annual AWS compute and database expenditures by $2.4M across 80+ engineering accounts.",
      },
      {
        id: uid(),
        text: "Mentored 30+ senior engineers and authored organization-wide Architecture Decision Records (ADRs) enforcing security and API contracts.",
      },
    ],
  });

  helperAdd(doc, "experience", {
    title: "Director of Infrastructure Engineering",
    organization: "Fauget Technologies",
    location: "Seattle, WA",
    start: "2016-01",
    end: "2020-03",
    bullets: [
      {
        id: uid(),
        text: "Led 42-person DevOps and Platform Engineering organization, building internal developer platform (IDP) that cut application deployment cycle time from 14 days to 18 minutes.",
      },
      {
        id: uid(),
        text: "Directed enterprise SOC 2 Type II and ISO 27001 compliance readiness audits with 100% zero-defect passing rate.",
      },
    ],
  });

  helperAdd(doc, "education", {
    title: "M.S. in Computer Science (Distributed Systems)",
    organization: "University of Washington",
    location: "Seattle, WA",
    start: "2014",
    end: "2016",
  });
  helperAdd(doc, "education", {
    title: "B.S. in Computer Engineering",
    organization: "University of California, Berkeley",
    location: "Berkeley, CA",
    start: "2010",
    end: "2014",
  });

  helperAdd(doc, "skills", {
    title: "Cloud & Systems Architecture",
    description:
      "AWS (EKS, RDS, S3) · Google Cloud Platform · Distributed Systems · Zero-Trust Security · Microservices · Event-Driven Architecture",
  });
  helperAdd(doc, "skills", {
    title: "DevOps & Infrastructure",
    description:
      "Kubernetes · Terraform · Docker · Istio Service Mesh · Kafka · Prometheus · Grafana · CI/CD Pipelines",
  });

  return doc;
}

export function createSarahJenkinsResume(): ResumeDocument {
  const doc = createDocument(false);
  doc.name = "Sarah Jenkins — Senior Business Analyst";
  doc.contact = {
    name: "Sarah Jenkins",
    headline: "Senior Business Analyst & Operations Lead",
    email: "sarah.jenkins@example.com",
    phone: "+1 (555) 789-0123",
    location: "Chicago, IL",
    website: "linkedin.com/in/sarah-jenkins-ba",
  };
  doc.presentation = {
    ...doc.presentation,
    template: "modern",
    accent: "plum",
    font: "sans",
    fontSize: 10,
    density: "balanced",
    showPhoto: false,
  };

  helperAdd(doc, "summary", {
    description:
      "Senior Business Analyst with 6+ years translating complex business workflows into high-impact digital products. Expertise in financial modeling, BPMN 2.0 process optimization, SQL data pipelines, and bridging enterprise stakeholders with engineering squads.",
  });

  helperAdd(doc, "experience", {
    title: "Senior Business Analyst",
    organization: "Apex Capital Advisors",
    location: "Chicago, IL",
    start: "2021-06",
    current: true,
    bullets: [
      {
        id: uid(),
        text: "Analyzed end-to-end commercial loan processing pipelines, automating verification steps to eliminate 35 manual hours weekly and save $420,000 annually.",
      },
      {
        id: uid(),
        text: "Authored 120+ Business Requirements Documents (BRDs), user stories, and acceptance criteria in Jira for 16 successful development sprint cycles.",
      },
      {
        id: uid(),
        text: "Created executive Tableau dashboards tracking real-time KPI metrics, portfolio performance, and cash-flow projections for C-level leadership.",
      },
    ],
  });

  helperAdd(doc, "experience", {
    title: "Business Systems Analyst",
    organization: "Deloitte Consulting",
    location: "Chicago, IL",
    start: "2018-08",
    end: "2021-05",
    bullets: [
      {
        id: uid(),
        text: "Facilitated business discovery workshops with 45+ enterprise stakeholders across retail and supply chain verticals.",
      },
      {
        id: uid(),
        text: "Mapped BPMN 2.0 operational process diagrams that streamlined supplier onboarding turnaround times from 16 days down to 3 days.",
      },
    ],
  });

  helperAdd(doc, "education", {
    title: "B.S. in Information Systems & Finance",
    organization: "University of Illinois Urbana-Champaign",
    location: "Champaign, IL",
    start: "2014",
    end: "2018",
  });

  helperAdd(doc, "skills", {
    title: "Business Analysis",
    description:
      "BPMN 2.0 · Requirements Gathering · Gap Analysis · Financial Modeling · User Stories · Acceptance Criteria · Agile / Scrum",
  });
  helperAdd(doc, "skills", {
    title: "Data & Systems Tools",
    description:
      "SQL (PostgreSQL, Snowflake) · Tableau · Power BI · Advanced Excel (VBA) · Jira · Confluence · SAP ERP",
  });

  return doc;
}

export function createSharyaSinghResume(): ResumeDocument {
  const doc = createDocument(false);
  doc.name = "Sharya Singh — Digital Growth Lead";
  doc.contact = {
    name: "Sharya Singh",
    headline: "Digital Growth & Web Marketing Lead",
    email: "sharya.singh@example.com",
    phone: "+1 (555) 234-5678",
    location: "Austin, TX",
    website: "sharyasingh.com",
    photoUrl: MARKETING_AVATAR_SVG,
  };
  doc.presentation = {
    ...doc.presentation,
    template: "minimalist",
    accent: "charcoal",
    font: "sans",
    fontSize: 10,
    density: "balanced",
    showPhoto: true,
  };

  helperAdd(doc, "summary", {
    description:
      "Performance marketing and web growth strategist with 5+ years scaling B2B SaaS revenue through organic SEO, high-converting web experiences, and data-driven customer funnels. Drove 210% increase in inbound qualified pipeline.",
  });

  helperAdd(doc, "experience", {
    title: "Senior Web Marketing Lead",
    organization: "Borcelle Media",
    location: "Austin, TX",
    start: "2021-04",
    current: true,
    bullets: [
      {
        id: uid(),
        text: "Executed technical SEO and content architecture overhaul, achieving #1 organic search ranking for 42 high-intent keywords and 220k monthly unique visits.",
      },
      {
        id: uid(),
        text: "Designed and tested 18 conversion-focused landing pages, lifting visitor-to-demo conversion rates from 2.8% to 6.4% and adding $1.8M in pipeline value.",
      },
      {
        id: uid(),
        text: "Managed $550,000 annual performance advertising budget across Google Search and LinkedIn with sustained 4.4x Return on Ad Spend (ROAS).",
      },
    ],
  });

  helperAdd(doc, "experience", {
    title: "Growth Marketing Specialist",
    organization: "Wardiere Digital",
    location: "Austin, TX",
    start: "2019-01",
    end: "2021-03",
    bullets: [
      {
        id: uid(),
        text: "Built automated email nurture workflows in HubSpot with customized behavioral triggers, increasing trial-to-paid conversion by 31%.",
      },
      {
        id: uid(),
        text: "Constructed attribution tracking dashboards in Google Analytics 4 and Looker Studio to measure multi-touch customer acquisition journeys.",
      },
    ],
  });

  helperAdd(doc, "education", {
    title: "B.A. in Marketing & Digital Communication",
    organization: "University of Texas at Austin",
    location: "Austin, TX",
    start: "2015",
    end: "2019",
  });

  helperAdd(doc, "skills", {
    title: "Growth & Acquisition",
    description:
      "Technical SEO · Conversion Rate Optimization (CRO) · A/B Testing · Google Analytics 4 · HubSpot · SEMrush · Paid Search",
  });
  helperAdd(doc, "skills", {
    title: "Creative & Web Tools",
    description:
      "Webflow · Copywriting · Content Strategy · HTML/CSS · Figma · Looker Studio · Customer Journey Mapping",
  });

  return doc;
}

export function getDemoResume(id: string): ResumeDocument | undefined {
  const profile = DEMO_PROFILES.find((p) => p.id === id);
  return profile ? profile.create() : undefined;
}
