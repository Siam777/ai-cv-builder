import type { ResumeDocument } from "../document";
import { METRIC_PATTERNS } from "./ats-linter";

export interface RoleBenchmark {
  id: string;
  title: string;
  description: string;
  category: "engineering" | "architecture" | "product" | "data" | "operations" | "design" | "marketing";
  coreCompetencies: string[];
  recommendedKeywords: string[];
  expectedMetricTypes: {
    name: string;
    description: string;
    example: string;
    pattern: RegExp;
  }[];
  seniorityKeywords: {
    junior: string[];
    mid: string[];
    senior: string[];
    leadOrArchitect: string[];
  };
}

export interface RoleAnalysisResult {
  roleId: string;
  roleTitle: string;
  overallScore: number; // 0 - 100
  competencyScore: number; // 0 - 100
  metricScore: number; // 0 - 100
  depthScore: number; // 0 - 100
  detectedSeniority: "Junior" | "Mid-Level" | "Senior" | "Lead / Architect";
  matchedCompetencies: string[];
  missingCompetencies: string[];
  matchedMetricTypes: string[];
  missingMetricTypes: {
    name: string;
    description: string;
    example: string;
  }[];
  actionableInsights: {
    id: string;
    type: "skill" | "metric" | "depth" | "seniority";
    severity: "high" | "medium" | "low";
    title: string;
    message: string;
    suggestion?: string;
    skillToAdd?: string;
  }[];
}

export const ROLE_BENCHMARKS: Record<string, RoleBenchmark> = {
  "software-engineer": {
    id: "software-engineer",
    title: "Software Engineer",
    description: "Evaluates full-stack/backend systems, API design, testing automation, and scale.",
    category: "engineering",
    coreCompetencies: [
      "TypeScript",
      "JavaScript",
      "Python",
      "React",
      "Node.js",
      "REST APIs",
      "SQL",
      "PostgreSQL",
      "Docker",
      "Git",
      "CI/CD",
      "Unit Testing",
      "Microservices",
    ],
    recommendedKeywords: [
      "GraphQL",
      "Redis",
      "AWS",
      "Kubernetes",
      "Agile",
      "Jest",
      "Tailwind CSS",
      "Next.js",
    ],
    expectedMetricTypes: [
      {
        name: "Latency & Performance",
        description: "Quantified reduction in latency or query response time.",
        example: "Reduced P99 API latency from 450ms to 85ms via Redis caching.",
        pattern: /\b\d+(\.\d+)?\s*(ms|milliseconds|seconds|% faster|% reduction|speedup)\b/i,
      },
      {
        name: "User & Traffic Scale",
        description: "Scale of requests, active users, or throughput supported.",
        example: "Scaled notification pipeline to handle 15M daily events with 99.99% reliability.",
        pattern: /\b\d+(\.\d+)?\s*(k|m|b|million|thousand|daily|monthly)?\s*(users|requests|events|queries|traffic|rpm|rps)\b/i,
      },
      {
        name: "Code Quality & Test Coverage",
        description: "Test coverage gains or automated regression prevention.",
        example: "Boosted test coverage from 62% to 91% across 14 core microservices.",
        pattern: /\b\d+(\.\d+)?%\s*(coverage|test coverage|pass rate|reduction in bugs)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["assisted", "implemented features", "fixed bugs", "learned", "collaborated with team"],
      mid: ["developed", "engineered", "refactored", "integrated", "built APIs", "tested"],
      senior: ["architected", "spearheaded", "mentored", "designed system", "led migration", "reduced technical debt"],
      leadOrArchitect: ["governed", "technical strategy", "cross-functional alignment", "RFC", "org-wide architecture", "hired"],
    },
  },
  "software-architect": {
    id: "software-architect",
    title: "Software / Solutions Architect",
    description: "Evaluates distributed systems, DDD, high-availability, multi-region resilience, and cloud ROI.",
    category: "architecture",
    coreCompetencies: [
      "System Design",
      "Distributed Systems",
      "Microservices Architecture",
      "Cloud Infrastructure (AWS/GCP/Azure)",
      "Domain-Driven Design (DDD)",
      "Event-Driven Architecture",
      "Kafka / Event Streaming",
      "Cost Optimization",
      "High Availability & Fault Tolerance",
      "API Gateway & Governance",
      "Kubernetes",
      "Database Partitioning / Sharding",
    ],
    recommendedKeywords: [
      "RFC / Architecture Decision Records (ADRs)",
      "Multi-Region Deployment",
      "Zero-Downtime Migration",
      "Disaster Recovery",
      "Observability",
      "Security & Compliance (SOC2 / ISO)",
    ],
    expectedMetricTypes: [
      {
        name: "Cloud Cost Optimization",
        description: "Measurable compute or cloud infrastructure spend reduction.",
        example: "Consolidated AWS container clusters, saving $180,000 in annual AWS compute costs.",
        pattern: /([$€£]\s*\d+|\b\d+\s*(dollars|usd|%))\s*(savings|reduction|saved|cut in cloud spend|cost optimization)\b/i,
      },
      {
        name: "High Availability & Uptime SLA",
        description: "Measurable service availability, recovery time, or fault tolerance.",
        example: "Engineered multi-region failover cluster achieving 99.995% uptime across 4 regions.",
        pattern: /\b99\.\d+%\s*(uptime|availability|sla|reliability)\b/i,
      },
      {
        name: "System Throughput & Scale",
        description: "High-volume data throughput or transactional concurrency.",
        example: "Architected event-driven ingestion engine capable of processing 120,000 transactions/second.",
        pattern: /\b\d+(\.\d+)?\s*(k|m|million|thousand)?\s*(tps|transactions|messages|events|ops)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["followed guidelines", "assisted design", "documented"],
      mid: ["designed components", "evaluated libraries", "contributed to design"],
      senior: ["architected services", "led architectural design", "standardized APIs"],
      leadOrArchitect: ["established technical vision", "authored ADRs", "enterprise governance", "cross-org consensus", "decommissioned legacy monorepo"],
    },
  },
  "programmer": {
    id: "programmer",
    title: "Programmer / Developer",
    description: "Evaluates core coding foundations, algorithms, data structures, bug triage, and code quality.",
    category: "engineering",
    coreCompetencies: [
      "Data Structures & Algorithms",
      "Object-Oriented Programming (OOP)",
      "Clean Code & Refactoring",
      "Git Version Control",
      "SQL & Query Optimization",
      "Debugging & Profiling",
      "Code Reviews",
      "Automated Testing",
      "Linux / Bash",
      "Software Design Patterns",
    ],
    recommendedKeywords: [
      "Memory Management",
      "Concurrency / Multithreading",
      "RESTful Services",
      "Agile / Scrum",
      "CI/CD Integration",
    ],
    expectedMetricTypes: [
      {
        name: "Bug Resolution & Stability",
        description: "Quantified reduction in defect rate or unresolved production bugs.",
        example: "Identified and resolved 48 critical memory leaks, cutting application crashes by 70%.",
        pattern: /\b\d+(\.\d+)?\s*(bugs|issues|defects|memory leaks|crashes|tickets|% reduction in bugs)\b/i,
      },
      {
        name: "Execution Speed & Profiling",
        description: "Algorithm optimization and CPU/memory footprint reductions.",
        example: "Refactored serialization algorithms, reducing execution time by 45%.",
        pattern: /\b\d+(\.\d+)?%\s*(faster|speedup|reduction in execution time|cpu reduction|memory footprint)\b/i,
      },
      {
        name: "Feature Delivery Velocity",
        description: "Sprint delivery and commit throughput.",
        example: "Shipped 18 core roadmap modules across 6 sprints with zero critical regressions.",
        pattern: /\b\d+\s*(modules|features|tickets|sprints|releases|deployments)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["wrote scripts", "resolved tickets", "assisted senior developers", "maintained"],
      mid: ["implemented algorithms", "profiled code", "developed modules", "refactored"],
      senior: ["optimized low-level performance", "established coding standards", "conducted deep reviews"],
      leadOrArchitect: ["spearheaded core framework", "defined development conventions"],
    },
  },
  "business-analyst": {
    id: "business-analyst",
    title: "Business Analyst",
    description: "Evaluates business requirements, stakeholder engagement, BPMN process mapping, gap analysis, and BI metrics.",
    category: "product",
    coreCompetencies: [
      "Requirements Gathering",
      "BRD / FRD Documentation",
      "User Stories & Acceptance Criteria",
      "Stakeholder Management",
      "BPMN / Business Process Mapping",
      "Gap Analysis",
      "Agile / Scrum Methodologies",
      "Data Analysis (SQL / Excel)",
      "Tableau / Power BI",
      "User Acceptance Testing (UAT)",
      "Cost-Benefit Analysis",
      "Cross-Functional Collaboration",
    ],
    recommendedKeywords: [
      "Jira & Confluence",
      "Workflow Automation",
      "Change Management",
      "Data Modeling",
      "ROI Evaluation",
      "ERP / CRM Integration",
    ],
    expectedMetricTypes: [
      {
        name: "Process Time & Efficiency Saved",
        description: "Quantified reduction in turnaround time or operational friction.",
        example: "Streamlined vendor onboarding workflow, reducing cycle time from 14 days to 3 days (78% faster).",
        pattern: /\b\d+(\.\d+)?\s*(%|hours|days|weeks|months|reduction in time|faster turnaround|efficiency gain)\b/i,
      },
      {
        name: "Financial Value / Cost Reduction",
        description: "Cost savings, revenue opportunities, or ROI achieved through analysis.",
        example: "Identified redundant licensing expenses, delivering $240k in annual recurring savings.",
        pattern: /([$€£]\s*[\d,]+(\.\d+)?|\b\d+\s*(dollars|usd|%))\s*(in\s+)?([a-z-]+\s+){0,3}(savings|revenue|roi|cost reduction|recovered|saved)\b/i,
      },
      {
        name: "Project On-Time & UAT Success Rate",
        description: "High adoption or successful defect-free UAT sign-off.",
        example: "Facilitated UAT across 6 business departments, securing 98% first-pass stakeholder sign-off.",
        pattern: /\b\d+(\.\d+)?%\s*([a-z-]+\s+){0,4}(adoption|sign-off|satisfaction|on-time delivery|accuracy)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["documented requirements", "gathered feedback", "assisted workshops", "logged tickets"],
      mid: ["authored BRDs", "mapped workflows", "conducted gap analysis", "led UAT sessions"],
      senior: ["managed executive stakeholders", "drove process re-engineering", "championed digital transformation"],
      leadOrArchitect: ["governed business architecture", "directed enterprise analysis initiatives", "mentored analysts"],
    },
  },
  "data-engineer": {
    id: "data-engineer",
    title: "Data Engineer / Data Scientist",
    description: "Evaluates ETL data pipelines, big data scale, ML modeling accuracy, and SQL warehousing.",
    category: "data",
    coreCompetencies: [
      "Python",
      "SQL",
      "ETL / ELT Pipelines",
      "Data Warehousing (Snowflake / BigQuery)",
      "Apache Spark",
      "Data Modeling",
      "Machine Learning",
      "Pandas & NumPy",
      "Airflow / Orchestration",
      "Kafka / Streaming",
      "Data Quality & Validation",
    ],
    recommendedKeywords: [
      "dbt",
      "PostgreSQL",
      "Scikit-Learn",
      "AWS S3",
      "Feature Engineering",
      "A/B Testing",
    ],
    expectedMetricTypes: [
      {
        name: "Data Volume & Pipeline Throughput",
        description: "Scale of datasets, tables, or records ingested per day.",
        example: "Engineered real-time Spark pipeline processing 4.2TB of raw event logs daily.",
        pattern: /\b\d+(\.\d+)?\s*(tb|gb|terabytes|gigabytes|million records|billion events|daily)\b/i,
      },
      {
        name: "Pipeline Latency & Runtime",
        description: "Reduction in nightly batch execution time.",
        example: "Optimized complex SQL join queries, cutting pipeline runtime by 64% from 3.5h to 75m.",
        pattern: /\b\d+(\.\d+)?\s*(% faster|% reduction in runtime|minutes|hours)\b/i,
      },
      {
        name: "Model Accuracy / Prediction Lift",
        description: "Model metric gains (F1-score, AUC-ROC, conversion lift).",
        example: "Trained gradient boosted classifier achieving 88% precision and 12% lift in conversion.",
        pattern: /\b\d+(\.\d+)?%\s*(accuracy|precision|recall|f1-score|lift|auc)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["wrote queries", "cleaned data", "built reports", "assisted pipeline maintenance"],
      mid: ["built ETL pipelines", "trained baseline models", "implemented dbt models", "optimized SQL"],
      senior: ["designed data lakehouse", "architected streaming pipelines", "deployed production ML models"],
      leadOrArchitect: ["enterprise data strategy", "governed data architecture", "established data mesh"],
    },
  },
  "product-manager": {
    id: "product-manager",
    title: "Product Manager",
    description: "Evaluates roadmap leadership, user discovery, conversion metrics, ARR growth, and GTM execution.",
    category: "product",
    coreCompetencies: [
      "Product Strategy & Roadmap",
      "PRD & Feature Specification",
      "User Research & Customer Interviews",
      "A/B Testing & Experimentation",
      "Product Analytics (Mixpanel / Amplitude)",
      "Agile / Scrum Leadership",
      "Go-To-Market (GTM) Strategy",
      "Feature Prioritization (RICE / MoSCoW)",
      "KPI & OKR Definition",
      "Cross-Functional Team Alignment",
    ],
    recommendedKeywords: [
      "Wireframing / Figma",
      "Market Analysis",
      "Customer Churn Mitigation",
      "Monetization & Pricing",
      "Stakeholder Presentations",
    ],
    expectedMetricTypes: [
      {
        name: "Revenue & ARR / MRR Growth",
        description: "Direct revenue lift, expansion ARR, or monetization gains.",
        example: "Launched tier-based pricing model generating $1.4M in incremental annual recurring revenue.",
        pattern: /([$€£]\s*\d+|\b\d+\s*(dollars|usd|%))\s*(arr|mrr|revenue|growth|sales|expansion)\b/i,
      },
      {
        name: "User Adoption & Engagement",
        description: "Increase in active users, signups, or core feature adoption.",
        example: "Redesigned onboarding checklist, lifting 30-day user retention from 22% to 41%.",
        pattern: /\b\d+(\.\d+)?%\s*(adoption|retention|conversion|dau|mau|engagement|signups)\b/i,
      },
      {
        name: "Delivery Cycle & Time-to-Market",
        description: "Velocity improvement from discovery to launch.",
        example: "Compressed feature delivery cycles by 35% through continuous discovery sprints.",
        pattern: /\b\d+(\.\d+)?\s*(% faster|weeks|months|reduction in time-to-market)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["assisted backlog", "wrote specs", "gathered user feedback"],
      mid: ["owned feature lifecycle", "defined PRDs", "ran sprint planning", "analyzed funnel"],
      senior: ["owned entire product domain", "drove multi-million dollar growth", "mentored APMs"],
      leadOrArchitect: ["directed product line", "established company OKRs", "guided executive board"],
    },
  },
  "devops-engineer": {
    id: "devops-engineer",
    title: "DevOps / Cloud Platform Engineer",
    description: "Evaluates Infrastructure as Code, Kubernetes orchestration, CI/CD pipelines, and high-uptime SLOs.",
    category: "operations",
    coreCompetencies: [
      "Kubernetes (K8s)",
      "Docker & Containers",
      "Terraform / Infrastructure as Code",
      "CI/CD Pipelines (GitHub Actions / GitLab)",
      "Cloud Providers (AWS / GCP / Azure)",
      "Linux Systems & Shell Scripting",
      "Monitoring & Metrics (Prometheus / Grafana)",
      "Incident Response & On-Call",
      "Network Security & IAM",
      "Site Reliability Engineering (SLO / SLA)",
    ],
    recommendedKeywords: [
      "Helm",
      "ArgoCD / GitOps",
      "Vault",
      "Zero-Downtime Deployment",
      "Disaster Recovery",
      "Cost Optimization",
    ],
    expectedMetricTypes: [
      {
        name: "Deployment Frequency & Velocity",
        description: "Increase in release frequency or decrease in build time.",
        example: "Modernized CI/CD with GitHub Actions, accelerating release cycles from bi-weekly to 14 deployments/day.",
        pattern: /\b\d+\s*(deployments\/day|releases|build speed|% faster builds|minutes to deploy)\b/i,
      },
      {
        name: "Availability & MTTR",
        description: "Uptime percentage or mean time to incident recovery.",
        example: "Introduced automated rollback gates, cutting Mean Time to Recovery (MTTR) by 75%.",
        pattern: /\b(\d+(\.\d+)?%\s*(uptime|availability|sla)|mttr\s*by\s*\d+%)\b/i,
      },
      {
        name: "Cloud Cost Infrastructure Savings",
        description: "Infrastructure downsizing and spot instance savings.",
        example: "Transitioned stateless workloads to AWS Graviton and Spot instances, saving $95,000 annually.",
        pattern: /([$€£]\s*\d+|\b\d+%\s*)\s*(savings|cloud spend|compute cost reduction)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["provisioned servers", "monitored alerts", "assisted pipeline scripts"],
      mid: ["authored Terraform modules", "configured Kubernetes clusters", "maintained CI/CD"],
      senior: ["architected zero-trust infrastructure", "spearheaded GitOps migration", "established SLA frameworks"],
      leadOrArchitect: ["enterprise platform engineering", "defined company cloud strategy", "governed security compliance"],
    },
  },
  "product-designer": {
    id: "product-designer",
    title: "Product & UX/UI Designer",
    description: "Evaluates design systems, user research, wireframing, interactive prototyping, Figma, and conversion UX.",
    category: "design",
    coreCompetencies: [
      "Design Systems",
      "Figma",
      "Interactive Prototyping",
      "User Research & Usability Testing",
      "Information Architecture",
      "Wireframing",
      "Mobile & Web UX",
      "WCAG 2.1 Accessibility",
      "Design Tokens",
      "User Journey Mapping",
      "A/B Experimentation",
      "Storybook / Design Handoff",
    ],
    recommendedKeywords: [
      "Framer",
      "Micro-interactions",
      "Design QA",
      "Miro",
      "Heuristic Evaluation",
      "Cross-Functional Alignment",
    ],
    expectedMetricTypes: [
      {
        name: "Conversion & Checkout Lift",
        description: "Quantified lift in user conversion, signup completion, or checkout success.",
        example: "Redesigned mobile checkout flow, lifting user conversion by 26% and decreasing churn by 14%.",
        pattern: /((\b\d+(\.\d+)?%[a-z\s]{0,25}(conversion|checkout|signup|activation|lift))|((conversion|checkout|signup|activation)[a-z\s]{0,25}\b\d+(\.\d+)?%))/i,
      },
      {
        name: "Churn & Drop-off Reduction",
        description: "Measurable reduction in drop-off rate, customer friction, or user churn.",
        example: "Conducted 36 usability testing sessions, cutting onboarding drop-off by 34%.",
        pattern: /((\b\d+(\.\d+)?%[a-z\s]{0,25}(churn|drop-off|drop off|friction|reduction))|((churn|drop-off|drop off|friction)[a-z\s]{0,25}\b\d+(\.\d+)?%))/i,
      },
      {
        name: "Accessibility & System Adoption",
        description: "Design system scale, WCAG compliance, or organization-wide component adoption.",
        example: "Partnered with engineers to guarantee 100% WCAG 2.1 AA accessibility compliance across 6 web applications.",
        pattern: /\b(wcag|100%|accessibility compliance|design system|stars|adopted across)\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["created wireframes", "assisted research", "built mockups", "updated components"],
      mid: ["designed responsive flows", "conducted usability tests", "built prototypes", "maintained components"],
      senior: ["architected design system", "spearheaded product redesign", "mentored designers", "drove conversion UX"],
      leadOrArchitect: ["established design vision", "governed multi-platform design tokens", "directed UX strategy", "executive alignment"],
    },
  },
  "marketing-lead": {
    id: "marketing-lead",
    title: "Digital Growth & Marketing Lead",
    description: "Evaluates growth marketing, technical SEO, conversion rate optimization (CRO), paid search, and funnel analytics.",
    category: "marketing",
    coreCompetencies: [
      "Technical SEO",
      "Conversion Rate Optimization (CRO)",
      "A/B Testing",
      "Google Analytics 4",
      "HubSpot / CRM",
      "Paid Search (SEM)",
      "Content Strategy & Copywriting",
      "Looker Studio / Data Studio",
      "Customer Funnel Optimization",
      "Performance Advertising (PPC)",
      "Email Marketing Automation",
      "Social Ads (LinkedIn / Meta)",
    ],
    recommendedKeywords: [
      "SEMrush",
      "Organic Rankings",
      "Customer Acquisition Cost (CAC)",
      "Return on Ad Spend (ROAS)",
      "Lead Generation",
      "Multi-Touch Attribution",
      "Lifecycle Marketing",
    ],
    expectedMetricTypes: [
      {
        name: "ROAS & Performance Ad Spend",
        description: "Return on ad spend or performance marketing budget scale.",
        example: "Managed $550,000 annual performance advertising budget with sustained 4.4x Return on Ad Spend (ROAS).",
        pattern: /(\b\d+(\.\d+)?x\s*roas|return on ad spend|[$€£]\s*[\d,]+(\.\d+)?\s*(annual|budget|ad spend|advertising budget))\b/i,
      },
      {
        name: "Conversion Rate & Funnel Lift",
        description: "Measurable increase in demo requests, lead-to-paid conversion, or visitor conversion rate.",
        example: "Designed 18 conversion landing pages, lifting visitor-to-demo conversion from 2.8% to 6.4%.",
        pattern: /((\b\d+(\.\d+)?%[a-z\s]{0,25}(conversion|trial-to-paid|demo|funnel|lead))|((conversion|trial-to-paid|demo|funnel|lead)[a-z\s]{0,25}\b\d+(\.\d+)?%))/i,
      },
      {
        name: "Pipeline Value & Revenue Generated",
        description: "Direct sales pipeline, annual recurring revenue, or inbound deal flow added.",
        example: "Added $1.8M in qualified inbound pipeline value through optimized acquisition channels.",
        pattern: /([$€£]\s*[\d,]+(\.\d+)?|\b\d+(\.\d+)?\s*(m|k|million))\s*(in\s+)?(pipeline|revenue|sales|pipeline value|arr)\b/i,
      },
      {
        name: "Organic Search & Traffic Growth",
        description: "Increase in organic rankings, unique monthly visitors, or SEO impressions.",
        example: "Achieved #1 organic ranking for 42 high-intent keywords and 220k monthly unique visits.",
        pattern: /\b(\d+(\.\d+)?%\s*(increase|growth|traffic)|\d+\s*(keywords|unique visits|monthly visits|impressions))\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["scheduled campaigns", "wrote ad copy", "monitored analytics", "assisted campaigns"],
      mid: ["managed paid campaigns", "optimized landing pages", "built email sequences", "conducted a/b tests"],
      senior: ["spearheaded growth strategy", "managed 6-figure marketing budgets", "scaled inbound pipeline", "mentored team"],
      leadOrArchitect: ["directed marketing division", "established company gtm strategy", "governed acquisition attribution", "multi-million pipeline"],
    },
  },
  "project-manager": {
    id: "project-manager",
    title: "Project Manager / Scrum Master",
    description: "Evaluates agile frameworks, sprint ceremonies, roadmap delivery, cross-team alignment, and risk triage.",
    category: "operations",
    coreCompetencies: [
      "Agile & Scrum Methodologies",
      "Sprint Planning & Backlog Refinement",
      "Jira & Confluence Administration",
      "Risk & Dependency Management",
      "Stakeholder Communication",
      "Resource & Capacity Planning",
      "Project Budgeting & Milestones",
      "Velocity & Burndown Tracking",
      "Cross-Functional Team Leadership",
      "Change Management",
    ],
    recommendedKeywords: [
      "Kanban",
      "PMP / CSM Certification",
      "OKRs",
      "Release Management",
      "Vendor Management",
      "Continuous Improvement",
    ],
    expectedMetricTypes: [
      {
        name: "On-Time Milestone Delivery",
        description: "Delivery percentage, roadmap on-time completion, or zero deadline slippage.",
        example: "Delivered 12 enterprise release milestones on-time across 4 distributed teams with 98% on-schedule rate.",
        pattern: /\b\d+(\.\d+)?%\s*(on-time|on time|on-schedule|milestones delivered|schedule adherence)\b/i,
      },
      {
        name: "Team Velocity & Cycle Time",
        description: "Quantified improvement in sprint throughput or reduction in cycle time.",
        example: "Boosted engineering sprint velocity by 38% while reducing cycle time from 12 days to 5 days.",
        pattern: /\b\d+(\.\d+)?%\s*(velocity|throughput|cycle time reduction|faster delivery)\b/i,
      },
      {
        name: "Budget & Cost Management",
        description: "Project budget stewardship, cost savings, or variance under budget.",
        example: "Delivered $3.2M enterprise migration project at 8% under approved capital expenditure budget.",
        pattern: /([$€£]\s*[\d,]+(\.\d+)?|\b\d+%\s*(under budget|budget savings|cost variance))\b/i,
      },
    ],
    seniorityKeywords: {
      junior: ["tracked tasks", "coordinated meetings", "logged risks", "assisted sprint backlog"],
      mid: ["facilitated sprint ceremonies", "managed roadmap milestones", "removed blockers", "tracked burndown"],
      senior: ["governed multi-team program delivery", "managed multi-million budgets", "optimized agile practices"],
      leadOrArchitect: ["directed PMO office", "enterprise agile transformation", "portfolio governance", "executive reporting"],
    },
  },
};

/**
 * Normalizes input text for keyword and competency matching.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[-_/.]/g, " ").replace(/\s+/g, " ");
}

/**
 * Inspects all visible text and bullet points inside a ResumeDocument to check for a skill or term.
 */
export function hasSkillInDocument(doc: ResumeDocument, skill: string): boolean {
  const checkSingleTerm = (term: string): boolean => {
    const norm = normalizeText(term);
    if (!norm) return false;
    const regex = new RegExp(`\\b${norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

    // 1. Check sections (especially skills, experience, projects)
    for (const s of doc.sections.filter((sec) => sec.visible)) {
      for (const e of s.entries) {
        if (regex.test(normalizeText(e.title))) return true;
        if (regex.test(normalizeText(e.organization))) return true;
        if (regex.test(normalizeText(e.description))) return true;
        for (const b of e.bullets) {
          if (regex.test(normalizeText(b.text))) return true;
        }
      }
    }

    // 2. Check headline
    if (regex.test(normalizeText(doc.contact.headline))) return true;

    return false;
  };

  if (checkSingleTerm(skill)) return true;

  // If skill has composite sub-terms like "A / B", "A & B", or "A (B)", check if sub-parts match
  const subParts = skill.split(/[/()&|]/).map((p) => p.trim()).filter((p) => p.length >= 3);
  if (subParts.length > 1 && subParts.some(checkSingleTerm)) return true;

  return false;
}

/**
 * Gathers all accomplishment bullet texts in visible experience/project sections.
 */
function getAllBullets(doc: ResumeDocument): string[] {
  const list: string[] = [];
  for (const s of doc.sections.filter((sec) => sec.visible)) {
    for (const e of s.entries) {
      if (e.description) list.push(e.description);
      for (const b of e.bullets) {
        if (b.text.trim()) list.push(b.text.trim());
      }
    }
  }
  return list;
}

/**
 * Analyzes a resume against a specific target role benchmark.
 */
export function analyzeResumeForRole(
  doc: ResumeDocument,
  roleKey?: string,
  customAppliedTitle?: string,
): RoleAnalysisResult {
  const resolvedRoleKey = roleKey || detectAppliedRoleFromDocument(doc).roleId;
  const benchmark = ROLE_BENCHMARKS[resolvedRoleKey] || ROLE_BENCHMARKS["software-engineer"];
  const allBullets = getAllBullets(doc);

  // 1. Core Competency Match
  const matchedCompetencies: string[] = [];
  const missingCompetencies: string[] = [];

  for (const comp of benchmark.coreCompetencies) {
    if (hasSkillInDocument(doc, comp)) {
      matchedCompetencies.push(comp);
    } else {
      missingCompetencies.push(comp);
    }
  }

  const competencyScore = Math.round(
    (matchedCompetencies.length / benchmark.coreCompetencies.length) * 100,
  );

  // 2. Expected Metrics Assessment
  const matchedMetricTypes: string[] = [];
  const missingMetricTypes: RoleAnalysisResult["missingMetricTypes"] = [];

  for (const metricType of benchmark.expectedMetricTypes) {
    const isMatched = allBullets.some((bullet) => metricType.pattern.test(bullet));
    if (isMatched) {
      matchedMetricTypes.push(metricType.name);
    } else {
      missingMetricTypes.push({
        name: metricType.name,
        description: metricType.description,
        example: metricType.example,
      });
    }
  }

  const metricScore = Math.round(
    (matchedMetricTypes.length / benchmark.expectedMetricTypes.length) * 100,
  );

  // 3. Technical Depth & Bullet Density
  let depthPoints = 0;
  if (allBullets.length >= 6) depthPoints += 40;
  else if (allBullets.length >= 3) depthPoints += 20;

  const quantifiedBulletCount = allBullets.filter((b) =>
    METRIC_PATTERNS.some((p) => p.test(b)),
  ).length;

  if (quantifiedBulletCount >= 3) depthPoints += 40;
  else if (quantifiedBulletCount >= 1) depthPoints += 20;

  if (allBullets.some((b) => b.length > 50)) depthPoints += 20;

  const depthScore = Math.min(100, depthPoints);

  // 4. Seniority Evaluation
  let juniorHits = 0;
  let midHits = 0;
  let seniorHits = 0;
  let leadHits = 0;

  const combinedText = allBullets.join(" ").toLowerCase();

  for (const kw of benchmark.seniorityKeywords.junior) {
    if (combinedText.includes(kw.toLowerCase())) juniorHits++;
  }
  for (const kw of benchmark.seniorityKeywords.mid) {
    if (combinedText.includes(kw.toLowerCase())) midHits++;
  }
  for (const kw of benchmark.seniorityKeywords.senior) {
    if (combinedText.includes(kw.toLowerCase())) seniorHits++;
  }
  for (const kw of benchmark.seniorityKeywords.leadOrArchitect) {
    if (combinedText.includes(kw.toLowerCase())) leadHits++;
  }

  let detectedSeniority: RoleAnalysisResult["detectedSeniority"] = "Mid-Level";
  if (leadHits >= 2 || (resolvedRoleKey === "software-architect" && seniorHits >= 2)) {
    detectedSeniority = "Lead / Architect";
  } else if (seniorHits >= 2) {
    detectedSeniority = "Senior";
  } else if (juniorHits > midHits && juniorHits > seniorHits) {
    detectedSeniority = "Junior";
  }

  // 5. Overall Weighted Composite Score
  const overallScore = Math.round(
    competencyScore * 0.45 + metricScore * 0.35 + depthScore * 0.2,
  );

  // 6. Actionable Insights Generation
  const actionableInsights: RoleAnalysisResult["actionableInsights"] = [];

  // Top Missing Competencies
  missingCompetencies.slice(0, 4).forEach((skill) => {
    actionableInsights.push({
      id: `missing-skill-${skill.toLowerCase().replace(/\s+/g, "-")}`,
      type: "skill",
      severity: "high",
      title: `Missing Core Skill: ${skill}`,
      message: `Recruiters and ATS filters screening for ${benchmark.title} roles look for ${skill}.`,
      suggestion: `If you have experience with ${skill}, click below to add it directly to your Skills inventory.`,
      skillToAdd: skill,
    });
  });

  // Missing Role-Specific Metrics
  missingMetricTypes.forEach((m) => {
    actionableInsights.push({
      id: `missing-metric-${m.name.toLowerCase().replace(/\s+/g, "-")}`,
      type: "metric",
      severity: "medium",
      title: `Add ${m.name} Metric`,
      message: m.description,
      suggestion: `Example for ${benchmark.title}: “${m.example}”`,
    });
  });

  // Bullet Depth Advice
  if (allBullets.length < 5) {
    actionableInsights.push({
      id: "bullet-volume-low",
      type: "depth",
      severity: "high",
      title: "Expand Accomplishment Bullets",
      message: `Your resume currently has ${allBullets.length} bullet accomplishments. Competitive ${benchmark.title} profiles usually showcase 3–5 high-impact bullets per role.`,
      suggestion: "Use Google XYZ structure: Accomplished [X], measured by [Y], by doing [Z].",
    });
  }

  return {
    roleId: benchmark.id,
    roleTitle: customAppliedTitle || benchmark.title,
    overallScore,
    competencyScore,
    metricScore,
    depthScore,
    detectedSeniority,
    matchedCompetencies,
    missingCompetencies,
    matchedMetricTypes,
    missingMetricTypes,
    actionableInsights,
  };
}

export interface AppliedRoleDetection {
  roleId: string;
  roleTitle: string;
  detectedHeadline: string;
  source: "headline" | "resume-name" | "experience" | "skills" | "fallback";
  confidence: "exact" | "high" | "moderate" | "fallback";
}

/**
 * Detects the role applied or targeted by a ResumeDocument.
 * Inspects candidate headline, document name, current job titles, and skills/summary.
 */
export function detectAppliedRoleFromDocument(doc: ResumeDocument): AppliedRoleDetection {
  const headline = doc.contact.headline?.trim() || "";
  const nameParts = doc.name ? doc.name.split(/[-—–|:]/) : [];
  const nameRole = nameParts.length > 1 ? nameParts.slice(1).join(" ").trim() : "";
  const expEntries = doc.sections.find((s) => s.type === "experience")?.entries || [];
  const topExpTitle = expEntries[0]?.title?.trim() || "";
  const allExpTitles = expEntries.map((e) => e.title).filter(Boolean).join(" ");
  const skillsText = doc.sections.find((s) => s.type === "skills")?.entries.map((e) => `${e.title} ${e.description}`).join(" ") || "";
  const summaryText = doc.sections.find((s) => s.type === "summary")?.entries.map((e) => e.description).join(" ") || "";

  const scoreTextAgainstRole = (text: string, roleId: string): number => {
    const t = text.toLowerCase();
    switch (roleId) {
      case "marketing-lead":
        if (/\b(market|marketing|growth|seo|cro|sem|performance market|web market|growth lead|acquisition|demand gen|content strateg|digital market)\b/i.test(t)) return 10;
        return 0;
      case "product-designer":
        if (/\b(designer|product design|ux|ui|ui\/ux|ux\/ui|interaction design|user experience|visual design|design system)\b/i.test(t)) return 10;
        return 0;
      case "software-architect":
        if (/\b(solutions architect|software architect|cloud architect|systems architect|enterprise architect|principal architect|vp engineering|director of infrastructure)\b/i.test(t)) return 10;
        if (/\barchitect\b/i.test(t) && !/\binterior\b/i.test(t)) return 8;
        return 0;
      case "business-analyst":
        if (/\b(business analyst|systems analyst|process analyst|operations analyst|operations lead|ba\b|functional analyst|bpmn)\b/i.test(t)) return 10;
        return 0;
      case "data-engineer":
        if (/\b(data engineer|data scientist|machine learning|analytics engineer|big data|ai engineer|ml engineer|deep learning|data analyst)\b/i.test(t)) return 10;
        return 0;
      case "product-manager":
        if (/\b(product manager|technical pm|product owner|product lead|head of product|director of product|group pm|apm\b)\b/i.test(t)) return 10;
        return 0;
      case "devops-engineer":
        if (/\b(devops|platform engineer|site reliability|sre|cloud platform|infrastructure engineer|cloud engineer)\b/i.test(t)) return 10;
        return 0;
      case "project-manager":
        if (/\b(project manager|scrum master|agile delivery|agile coach|program manager|delivery manager|pmp)\b/i.test(t)) return 10;
        return 0;
      case "programmer":
        if (/\b(programmer|coder|software developer|application developer|web developer|core developer)\b/i.test(t)) return 10;
        return 0;
      case "software-engineer":
        if (/\b(software engineer|full stack|fullstack|frontend engineer|front-end|backend engineer|back-end|cloud developer)\b/i.test(t)) return 10;
        if (/\bengineer\b/i.test(t)) return 5;
        return 0;
      default:
        return 0;
    }
  };

  const roleKeys = Object.keys(ROLE_BENCHMARKS);

  // 1. Check Headline (Highest priority - what the candidate explicitly claims/applies as!)
  if (headline) {
    let bestRole = "";
    let maxScore = 0;
    for (const rk of roleKeys) {
      const score = scoreTextAgainstRole(headline, rk);
      if (score > maxScore) {
        maxScore = score;
        bestRole = rk;
      }
    }
    if (bestRole && maxScore > 0) {
      return {
        roleId: bestRole,
        roleTitle: ROLE_BENCHMARKS[bestRole]?.title || bestRole,
        detectedHeadline: headline,
        source: "headline",
        confidence: "exact",
      };
    }
  }

  // 2. Check Name Role ("Sharya Singh — Digital Growth Lead")
  if (nameRole) {
    let bestRole = "";
    let maxScore = 0;
    for (const rk of roleKeys) {
      const score = scoreTextAgainstRole(nameRole, rk);
      if (score > maxScore) {
        maxScore = score;
        bestRole = rk;
      }
    }
    if (bestRole && maxScore > 0) {
      return {
        roleId: bestRole,
        roleTitle: ROLE_BENCHMARKS[bestRole]?.title || bestRole,
        detectedHeadline: nameRole,
        source: "resume-name",
        confidence: "high",
      };
    }
  }

  // 3. Check Current Experience Title ("Senior Web Marketing Lead")
  if (topExpTitle) {
    let bestRole = "";
    let maxScore = 0;
    for (const rk of roleKeys) {
      const score = scoreTextAgainstRole(topExpTitle, rk);
      if (score > maxScore) {
        maxScore = score;
        bestRole = rk;
      }
    }
    if (bestRole && maxScore > 0) {
      return {
        roleId: bestRole,
        roleTitle: ROLE_BENCHMARKS[bestRole]?.title || bestRole,
        detectedHeadline: topExpTitle,
        source: "experience",
        confidence: "high",
      };
    }
  }

  // 4. Check Aggregate Experience & Skills & Summary
  const combinedBody = `${allExpTitles} ${skillsText} ${summaryText}`;
  let bestRole = "";
  let maxScore = 0;
  for (const rk of roleKeys) {
    const score = scoreTextAgainstRole(combinedBody, rk);
    if (score > maxScore) {
      maxScore = score;
      bestRole = rk;
    }
  }
  if (bestRole && maxScore > 0) {
    return {
      roleId: bestRole,
      roleTitle: ROLE_BENCHMARKS[bestRole]?.title || bestRole,
      detectedHeadline: headline || topExpTitle || ROLE_BENCHMARKS[bestRole]?.title || "",
      source: "skills",
      confidence: "moderate",
    };
  }

  // 5. Fallback Default
  return {
    roleId: "software-engineer",
    roleTitle: ROLE_BENCHMARKS["software-engineer"].title,
    detectedHeadline: headline || "General Professional",
    source: "fallback",
    confidence: "fallback",
  };
}

