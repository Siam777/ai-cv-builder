import { createDocument, newEntry, uid, createCustomSection } from "./document";
import type { DemoResumeMeta } from "./demo-resumes";

const starters: Array<
  Omit<DemoResumeMeta, "create" | "hasPhoto" | "recommendedAccent"> & {
    skills: string;
    organization: string;
    bullets: string[];
    prior?: string;
  }
> = [
  {
    id: "mira-chen",
    name: "Mira Chen",
    role: "Product Manager",
    category: "business",
    headline: "Product Manager · Research & Delivery",
    recommendedTemplate: "portfolio",
    summaryPreview:
      "Turns customer research into focused releases and understandable product decisions.",
    skills:
      "Product discovery · Interview planning · Roadmaps · SQL · Accessibility",
    organization: "Northlake Tools (fictional)",
    bullets: [
      "Synthesized customer interviews into a prioritization brief used by design and engineering for the onboarding release.",
      "Introduced release notes and a feedback review with support, making unresolved customer requests visible to the product team.",
      "Defined activation events with the analytics team and documented measurement limitations before reviewing the launch.",
    ],
    prior: "Product Operations Associate",
  },
  {
    id: "devon-brooks",
    name: "Devon Brooks",
    role: "Data Analyst",
    category: "tech",
    headline: "Data Analyst · Reporting & Data Quality",
    recommendedTemplate: "tech",
    summaryPreview:
      "Builds traceable reporting, checks source quality and explains analytical uncertainty.",
    skills: "SQL · Python · Tableau · Data validation · Stakeholder reporting",
    organization: "Harbor Market (fictional)",
    bullets: [
      "Built a weekly reporting workflow with SQL reconciliation checks and documented definitions for operations managers.",
      "Investigated mismatched order totals and worked with engineering to correct a duplicated event source.",
      "Presented cohort results with caveats for incomplete records, helping the team choose a follow-up study.",
    ],
    prior: "Reporting Assistant",
  },
  {
    id: "noor-rahman",
    name: "Noor Rahman",
    role: "Project Manager",
    category: "business",
    headline: "Project Manager · Cross-functional Delivery",
    recommendedTemplate: "timeline",
    summaryPreview:
      "Coordinates delivery through clear ownership, risk tracking and accessible handovers.",
    skills:
      "Delivery planning · Risk registers · Facilitation · Jira · Vendor coordination",
    organization: "Cedar Transit (fictional)",
    bullets: [
      "Coordinated an internal scheduling rollout across operations, support and engineering with named owners for every release task.",
      "Maintained a shared risk register and escalated unresolved dependencies before the deployment review.",
      "Prepared training notes and a support handover, giving the service desk a documented route for common questions.",
    ],
    prior: "Project Coordinator",
  },
  {
    id: "elena-marsh",
    name: "Elena Marsh",
    role: "HR Professional",
    category: "business",
    headline: "People Operations · Employee Experience",
    recommendedTemplate: "classic",
    summaryPreview:
      "Supports consistent hiring, thoughtful onboarding and clear employee guidance.",
    skills:
      "Interview coordination · Onboarding · Policy documentation · HR reporting",
    organization: "Willow Works (fictional)",
    bullets: [
      "Reorganized onboarding guidance into role-specific checklists reviewed by hiring managers and new employees.",
      "Created an interview scheduling process with consistent candidate communications and documented escalation owners.",
      "Prepared anonymized workforce summaries for planning meetings while restricting access to employee records.",
    ],
    prior: "People Operations Coordinator",
  },
  {
    id: "avery-stone",
    name: "Avery Stone",
    role: "Senior Leader",
    category: "executive",
    headline: "Operations Director · Service & Team Development",
    recommendedTemplate: "executive",
    summaryPreview:
      "Connects service strategy with team development, operating reviews and accountable decisions.",
    skills:
      "Operational strategy · Budget planning · Coaching · Service design · Governance",
    organization: "Stonebridge Services (fictional)",
    bullets: [
      "Established a quarterly operating review linking service commitments, staffing assumptions and accountable action owners.",
      "Led a cross-functional redesign of the customer escalation process and introduced a documented decision record.",
      "Developed a coaching program with team leads and used qualitative feedback to refine its first cycle.",
      "Reviewed supplier commitments with finance and legal, clarifying responsibilities before renewing service agreements.",
    ],
    prior: "Service Delivery Manager",
  },
  {
    id: "imani-reed",
    name: "Imani Reed",
    role: "Research Graduate",
    category: "tech",
    headline: "Environmental Science Graduate · Research Methods",
    recommendedTemplate: "academic",
    summaryPreview:
      "Early-career researcher with fieldwork, reproducible analysis and science communication experience.",
    skills:
      "R · Literature review · Field sampling · Research ethics · Scientific writing",
    organization: "Westhaven Research Lab (fictional)",
    bullets: [
      "Documented sampling procedures and prepared a reproducible R notebook for a supervised water-quality study.",
      "Checked field logs against laboratory records and flagged missing observations in the project report.",
      "Presented a student research poster explaining the study's methods and limitations.",
    ],
  },
  {
    id: "jules-martin",
    name: "Jules Martin",
    role: "Career Changer",
    category: "business",
    headline: "Customer Support → Learning & Development",
    recommendedTemplate: "minimalist",
    summaryPreview:
      "Brings customer support experience into clear training materials and learner-focused facilitation.",
    skills:
      "Training design · Facilitation · Knowledge bases · Customer support · Feedback analysis",
    organization: "Orchard Learning (fictional)",
    bullets: [
      "Created a practice onboarding module with facilitator notes and an accessible participant guide during a learning-design course.",
      "Translated recurring support questions into a searchable knowledge-base guide in a previous customer service role.",
      "Facilitated peer practice sessions and incorporated feedback on clarity into the revised course materials.",
    ],
    prior: "Customer Support Specialist",
  },
];

export const additionalDemoProfiles: DemoResumeMeta[] = starters.map(
  (starter) => ({
    ...starter,
    recommendedAccent: starter.category === "executive" ? "slate" : "navy",
    hasPhoto: false,
    create: () => {
      const doc = createDocument(false);
      doc.name = `${starter.name} — ${starter.role}`;
      doc.provenance = {
        purpose: "practice",
        origin: "example",
        exampleId: starter.id,
      };
      doc.contact = {
        name: starter.name,
        headline: starter.headline,
        email: `${starter.id}@example.com`,
        phone: "+1 (202) 555-0150",
        location: "Example City",
        website: `example.com/${starter.id}`,
      };
      doc.presentation = {
        ...doc.presentation,
        template: starter.recommendedTemplate,
        font: ["academic", "executive", "classic"].includes(
          starter.recommendedTemplate,
        )
          ? "serif"
          : "sans",
        fontSize: 11,
        accent: "navy",
        showPhoto: false,
      };
      const add = (
        type: string,
        values: Partial<ReturnType<typeof newEntry>>,
      ) =>
        doc.sections
          .find((section) => section.type === type)!
          .entries.push({ ...newEntry(), ...values });
      add("summary", { description: starter.summaryPreview });
      add("experience", {
        title: starter.role,
        organization: starter.organization,
        start: starter.id === "imani-reed" ? "2025" : "2022",
        current: true,
        bullets: starter.bullets.map((text) => ({ id: uid(), text })),
      });
      if (starter.prior)
        add("experience", {
          title: starter.prior,
          organization: "Maple Community Services (fictional)",
          start: "2019",
          end: "2022",
          description:
            "Supported team documentation, coordinated requests and maintained clear handover notes for colleagues.",
        });
      add("education", {
        title:
          starter.id === "imani-reed"
            ? "BSc Environmental Science"
            : starter.id === "jules-martin"
              ? "Certificate in Learning Design"
              : "BA Interdisciplinary Studies",
        organization: "Westhaven College (fictional)",
        end: starter.id === "imani-reed" ? "2025" : "2019",
      });
      add("skills", { description: starter.skills });
      if (starter.id === "imani-reed")
        doc.sections.push(
          createCustomSection("Research & Presentations", [
            {
              ...newEntry(),
              title: "Student Water-quality Research Poster",
              organization: "Westhaven Student Research Forum (fictional)",
              end: "2025",
              description:
                "A supervised student presentation; no peer-reviewed publication is claimed.",
            },
          ]),
        );
      return doc;
    },
  }),
);
