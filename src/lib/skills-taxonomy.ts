/**
 * Searchable Skills Taxonomy Engine & Autocomplete System
 *
 * Provides a curated, categorized taxonomy of standard technical and professional
 * skills with synonym resolution, alias matching, and text formatting utilities.
 */

export type SkillCategory =
  | "frontend"
  | "backend"
  | "cloud_devops"
  | "database"
  | "data_ai"
  | "mobile"
  | "product_design"
  | "testing_qa"
  | "management_agile";

export interface TaxonomySkill {
  id: string; // canonical slug, e.g. "typescript"
  name: string; // canonical display name, e.g. "TypeScript"
  category: SkillCategory;
  aliases: string[]; // e.g. ["ts", "type-script"]
}

export interface SkillCategoryMeta {
  id: SkillCategory;
  label: string;
  icon: string;
  popularSkills: string[];
}

export const SKILL_CATEGORIES: SkillCategoryMeta[] = [
  {
    id: "frontend",
    label: "Frontend & Web",
    icon: "🌐",
    popularSkills: [
      "React",
      "TypeScript",
      "Next.js",
      "JavaScript",
      "Tailwind CSS",
      "Vue.js",
      "HTML5",
      "CSS3",
      "Redux",
    ],
  },
  {
    id: "backend",
    label: "Backend & Systems",
    icon: "⚙️",
    popularSkills: [
      "Node.js",
      "Python",
      "Go",
      "Java",
      "Rust",
      "C#",
      "PostgreSQL",
      "FastAPI",
      "REST APIs",
      "GraphQL",
    ],
  },
  {
    id: "cloud_devops",
    label: "Cloud & DevOps",
    icon: "☁️",
    popularSkills: [
      "AWS",
      "Kubernetes",
      "Docker",
      "Terraform",
      "CI/CD",
      "GitHub Actions",
      "Google Cloud",
      "Microsoft Azure",
      "Linux",
    ],
  },
  {
    id: "database",
    label: "Databases & Storage",
    icon: "🗄️",
    popularSkills: [
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "Redis",
      "SQLite",
      "Elasticsearch",
      "Apache Kafka",
      "DynamoDB",
      "Prisma",
    ],
  },
  {
    id: "data_ai",
    label: "Data Science & AI",
    icon: "🧠",
    popularSkills: [
      "Python",
      "SQL",
      "PyTorch",
      "TensorFlow",
      "Pandas & NumPy",
      "Large Language Models",
      "Scikit-Learn",
      "Snowflake",
      "Apache Spark",
      "LangChain",
    ],
  },
  {
    id: "mobile",
    label: "Mobile Development",
    icon: "📱",
    popularSkills: [
      "React Native",
      "Flutter",
      "iOS / Swift",
      "Android / Kotlin",
      "Expo",
    ],
  },
  {
    id: "product_design",
    label: "Product & Design",
    icon: "🎨",
    popularSkills: [
      "Figma",
      "UI/UX Design",
      "Design Systems",
      "User Research",
      "Prototyping",
      "Product Strategy",
      "Agile / Scrum",
      "Wireframing",
    ],
  },
  {
    id: "testing_qa",
    label: "Testing & Quality",
    icon: "🧪",
    popularSkills: [
      "Jest",
      "Playwright",
      "Cypress",
      "Unit Testing",
      "Vitest",
      "Integration Testing",
      "API Testing",
    ],
  },
  {
    id: "management_agile",
    label: "Leadership & Agile",
    icon: "👥",
    popularSkills: [
      "Technical Leadership",
      "Agile / Scrum",
      "System Architecture",
      "Jira",
      "Mentorship",
      "OWASP & AppSec",
      "SOC 2 Compliance",
    ],
  },
];

export const TAXONOMY_SKILLS: TaxonomySkill[] = [
  // --- FRONTEND ---
  {
    id: "react",
    name: "React",
    category: "frontend",
    aliases: ["react.js", "reactjs", "react-dom"],
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "frontend",
    aliases: ["next.js", "next"],
  },
  {
    id: "typescript",
    name: "TypeScript",
    category: "frontend",
    aliases: ["ts", "type-script"],
  },
  {
    id: "javascript",
    name: "JavaScript",
    category: "frontend",
    aliases: ["js", "es6", "ecmascript"],
  },
  {
    id: "vue",
    name: "Vue.js",
    category: "frontend",
    aliases: ["vue", "vuejs", "vue3"],
  },
  {
    id: "nuxt",
    name: "Nuxt.js",
    category: "frontend",
    aliases: ["nuxt", "nuxtjs"],
  },
  {
    id: "angular",
    name: "Angular",
    category: "frontend",
    aliases: ["angularjs", "angular 2+"],
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "frontend",
    aliases: ["sveltekit", "svelte.js"],
  },
  {
    id: "html5",
    name: "HTML5",
    category: "frontend",
    aliases: ["html", "semantic html"],
  },
  {
    id: "css3",
    name: "CSS3",
    category: "frontend",
    aliases: ["css", "sass", "scss", "less"],
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    category: "frontend",
    aliases: ["tailwind", "tailwindcss"],
  },
  {
    id: "redux",
    name: "Redux",
    category: "frontend",
    aliases: ["redux toolkit", "rtk", "redux-saga"],
  },
  {
    id: "graphql-client",
    name: "GraphQL Client",
    category: "frontend",
    aliases: ["apollo client", "urql", "relay"],
  },
  {
    id: "bundlers",
    name: "Webpack & Vite",
    category: "frontend",
    aliases: ["vite", "webpack", "rollup", "turbopack", "esbuild"],
  },

  // --- BACKEND ---
  {
    id: "nodejs",
    name: "Node.js",
    category: "backend",
    aliases: ["node", "nodejs"],
  },
  {
    id: "express",
    name: "Express.js",
    category: "backend",
    aliases: ["express", "expressjs"],
  },
  {
    id: "nestjs",
    name: "NestJS",
    category: "backend",
    aliases: ["nest.js", "nest"],
  },
  {
    id: "python",
    name: "Python",
    category: "backend",
    aliases: ["py", "python3"],
  },
  {
    id: "django",
    name: "Django",
    category: "backend",
    aliases: ["django rest framework", "drf"],
  },
  {
    id: "fastapi",
    name: "FastAPI",
    category: "backend",
    aliases: ["fast-api"],
  },
  {
    id: "golang",
    name: "Go",
    category: "backend",
    aliases: ["golang", "go-lang"],
  },
  {
    id: "rust",
    name: "Rust",
    category: "backend",
    aliases: ["rs", "rustlang"],
  },
  {
    id: "java",
    name: "Java",
    category: "backend",
    aliases: ["jdk", "jvm", "java 17", "java 21"],
  },
  {
    id: "springboot",
    name: "Spring Boot",
    category: "backend",
    aliases: ["spring", "springboot", "spring framework"],
  },
  {
    id: "csharp",
    name: "C#",
    category: "backend",
    aliases: ["c-sharp", "csharp"],
  },
  {
    id: "dotnet",
    name: ".NET Core",
    category: "backend",
    aliases: [".net", "dotnet", "asp.net core", "asp.net"],
  },
  {
    id: "ruby",
    name: "Ruby on Rails",
    category: "backend",
    aliases: ["rails", "ruby", "ror"],
  },
  {
    id: "php",
    name: "PHP",
    category: "backend",
    aliases: ["php8", "laravel", "symfony"],
  },
  {
    id: "rest",
    name: "REST APIs",
    category: "backend",
    aliases: ["rest", "restful", "restful apis", "rest api"],
  },
  {
    id: "graphql",
    name: "GraphQL",
    category: "backend",
    aliases: ["apollo server", "graphql api"],
  },
  {
    id: "grpc",
    name: "gRPC",
    category: "backend",
    aliases: ["grpc", "protobuf", "protocol buffers"],
  },
  {
    id: "microservices",
    name: "Microservices",
    category: "backend",
    aliases: ["micro-services", "service-oriented architecture", "soa"],
  },

  // --- CLOUD & DEVOPS ---
  {
    id: "aws",
    name: "AWS",
    category: "cloud_devops",
    aliases: [
      "amazon web services",
      "ec2",
      "s3",
      "lambda",
      "ecs",
      "eks",
      "cloudformation",
    ],
  },
  {
    id: "gcp",
    name: "Google Cloud",
    category: "cloud_devops",
    aliases: [
      "gcp",
      "google cloud platform",
      "cloud run",
      "gke",
      "bigquery",
    ],
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    category: "cloud_devops",
    aliases: ["azure", "azure devops", "azure functions"],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "cloud_devops",
    aliases: ["k8s", "kubectl"],
  },
  {
    id: "docker",
    name: "Docker",
    category: "cloud_devops",
    aliases: ["containers", "docker-compose", "containerization"],
  },
  {
    id: "terraform",
    name: "Terraform",
    category: "cloud_devops",
    aliases: ["tf", "infrastructure as code", "iac"],
  },
  {
    id: "cicd",
    name: "CI/CD",
    category: "cloud_devops",
    aliases: [
      "cicd",
      "continuous integration",
      "continuous deployment",
      "ci / cd",
    ],
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "cloud_devops",
    aliases: ["gh actions", "github workflow"],
  },
  {
    id: "linux",
    name: "Linux",
    category: "cloud_devops",
    aliases: ["bash", "unix", "shell scripting", "ubuntu", "debian"],
  },
  {
    id: "nginx",
    name: "Nginx",
    category: "cloud_devops",
    aliases: ["nginx reverse proxy"],
  },
  {
    id: "ansible",
    name: "Ansible",
    category: "cloud_devops",
    aliases: ["configuration management"],
  },
  {
    id: "helm",
    name: "Helm",
    category: "cloud_devops",
    aliases: ["helm charts"],
  },

  // --- DATABASES & STORAGE ---
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    aliases: ["postgres", "pgsql"],
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    aliases: ["mariadb"],
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "database",
    aliases: ["sqlite3", "libsql", "turso"],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "database",
    aliases: ["mongo", "nosql"],
  },
  {
    id: "redis",
    name: "Redis",
    category: "database",
    aliases: ["redis cache", "in-memory database"],
  },
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    category: "database",
    aliases: ["elastic", "opensearch", "elk stack"],
  },
  {
    id: "dynamodb",
    name: "DynamoDB",
    category: "database",
    aliases: ["amazon dynamodb"],
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "database",
    aliases: ["supabase postgres"],
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "database",
    aliases: ["firestore", "firebase realtime database"],
  },
  {
    id: "kafka",
    name: "Apache Kafka",
    category: "database",
    aliases: ["kafka", "event streaming"],
  },
  {
    id: "rabbitmq",
    name: "RabbitMQ",
    category: "database",
    aliases: ["message queue", "amqp"],
  },
  {
    id: "prisma",
    name: "Prisma",
    category: "database",
    aliases: ["prisma orm", "drizzle", "typeorm"],
  },

  // --- DATA SCIENCE & AI ---
  {
    id: "pandas-numpy",
    name: "Pandas & NumPy",
    category: "data_ai",
    aliases: ["pandas", "numpy", "scipy"],
  },
  {
    id: "scikit-learn",
    name: "Scikit-Learn",
    category: "data_ai",
    aliases: ["sklearn", "scikit learn", "machine learning"],
  },
  {
    id: "pytorch",
    name: "PyTorch",
    category: "data_ai",
    aliases: ["torch", "deep learning"],
  },
  {
    id: "tensorflow",
    name: "TensorFlow",
    category: "data_ai",
    aliases: ["keras", "tf"],
  },
  {
    id: "sql",
    name: "SQL",
    category: "data_ai",
    aliases: ["structured query language", "t-sql", "pl/sql"],
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "data_ai",
    aliases: ["snowflake data warehouse"],
  },
  {
    id: "spark",
    name: "Apache Spark",
    category: "data_ai",
    aliases: ["spark", "pyspark"],
  },
  {
    id: "databricks",
    name: "Databricks",
    category: "data_ai",
    aliases: ["databricks lakehouse"],
  },
  {
    id: "llms",
    name: "Large Language Models",
    category: "data_ai",
    aliases: ["llm", "llms", "openai api", "gpt", "gemini", "claude"],
  },
  {
    id: "langchain",
    name: "LangChain",
    category: "data_ai",
    aliases: ["langchain", "llamaindex", "rag"],
  },
  {
    id: "nlp",
    name: "Natural Language Processing",
    category: "data_ai",
    aliases: ["nlp", "spacy", "hugging face", "transformers"],
  },
  {
    id: "computer-vision",
    name: "Computer Vision",
    category: "data_ai",
    aliases: ["opencv", "image processing"],
  },

  // --- MOBILE ---
  {
    id: "react-native",
    name: "React Native",
    category: "mobile",
    aliases: ["react-native", "expo"],
  },
  {
    id: "flutter",
    name: "Flutter",
    category: "mobile",
    aliases: ["dart"],
  },
  {
    id: "ios-swift",
    name: "iOS / Swift",
    category: "mobile",
    aliases: ["swift", "swiftui", "uikit", "xcode", "ios"],
  },
  {
    id: "android-kotlin",
    name: "Android / Kotlin",
    category: "mobile",
    aliases: ["kotlin", "jetpack compose", "android sdk", "android"],
  },

  // --- PRODUCT & DESIGN ---
  {
    id: "figma",
    name: "Figma",
    category: "product_design",
    aliases: ["figma design", "figjam"],
  },
  {
    id: "ui-ux",
    name: "UI/UX Design",
    category: "product_design",
    aliases: [
      "ui design",
      "ux design",
      "user experience",
      "user interface",
      "interaction design",
    ],
  },
  {
    id: "design-systems",
    name: "Design Systems",
    category: "product_design",
    aliases: ["design system", "component library", "storybook"],
  },
  {
    id: "user-research",
    name: "User Research",
    category: "product_design",
    aliases: [
      "usability testing",
      "user interviews",
      "heuristic evaluation",
      "customer research",
    ],
  },
  {
    id: "prototyping",
    name: "Prototyping",
    category: "product_design",
    aliases: ["interactive prototypes", "rapid prototyping"],
  },
  {
    id: "product-strategy",
    name: "Product Strategy",
    category: "product_design",
    aliases: ["roadmapping", "product lifecycle", "prds", "product management"],
  },
  {
    id: "wireframing",
    name: "Wireframing",
    category: "product_design",
    aliases: ["lo-fi wireframes", "information architecture"],
  },

  // --- TESTING & QA ---
  {
    id: "jest",
    name: "Jest",
    category: "testing_qa",
    aliases: ["jest framework", "ts-jest"],
  },
  {
    id: "playwright",
    name: "Playwright",
    category: "testing_qa",
    aliases: ["playwright e2e"],
  },
  {
    id: "cypress",
    name: "Cypress",
    category: "testing_qa",
    aliases: ["cypress.io"],
  },
  {
    id: "unit-testing",
    name: "Unit Testing",
    category: "testing_qa",
    aliases: ["tdd", "unit tests", "test-driven development"],
  },
  {
    id: "vitest",
    name: "Vitest",
    category: "testing_qa",
    aliases: ["vitest runner"],
  },
  {
    id: "integration-testing",
    name: "Integration Testing",
    category: "testing_qa",
    aliases: ["end-to-end testing", "e2e"],
  },
  {
    id: "api-testing",
    name: "API Testing",
    category: "testing_qa",
    aliases: ["postman", "insomnia", "supertest"],
  },

  // --- MANAGEMENT & LEADERSHIP ---
  {
    id: "tech-leadership",
    name: "Technical Leadership",
    category: "management_agile",
    aliases: ["tech lead", "engineering management", "mentorship", "team lead"],
  },
  {
    id: "system-architecture",
    name: "System Architecture",
    category: "management_agile",
    aliases: ["system design", "distributed systems", "high availability"],
  },
  {
    id: "agile-scrum",
    name: "Agile / Scrum",
    category: "management_agile",
    aliases: ["scrum", "kanban", "sprint planning", "agile"],
  },
  {
    id: "jira",
    name: "Jira",
    category: "management_agile",
    aliases: ["jira software", "confluence"],
  },
  {
    id: "appsec",
    name: "OWASP & AppSec",
    category: "management_agile",
    aliases: ["security best practices", "vulnerability scanning", "owasp"],
  },
  {
    id: "soc2",
    name: "SOC 2 Compliance",
    category: "management_agile",
    aliases: ["soc2", "compliance", "gdpr", "hipaa"],
  },
];

/**
 * Normalizes text for taxonomy searching (lowercases, trims, cleans punctuation except key programming chars).
 */
export function normalizeSearchTerm(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .replace(/[^\w\s\.\+\#\/\-]/g, "");
}

/**
 * Resolves a raw string against taxonomy names and aliases.
 */
export function resolveCanonicalSkill(raw: string): TaxonomySkill | null {
  const normalized = normalizeSearchTerm(raw);
  if (!normalized) return null;

  for (const skill of TAXONOMY_SKILLS) {
    if (normalizeSearchTerm(skill.name) === normalized) return skill;
    if (skill.id === normalized) return skill;
    if (skill.aliases.some((a) => normalizeSearchTerm(a) === normalized)) {
      return skill;
    }
  }

  return null;
}

/**
 * Search the skills taxonomy with rank-ordered prefix, alias, and substring matching.
 */
export function searchSkillsTaxonomy(
  query: string,
  options?: { category?: SkillCategory; strictCategory?: boolean; limit?: number },
): TaxonomySkill[] {
  const normQuery = normalizeSearchTerm(query);
  if (!normQuery) {
    if (options?.category) {
      return getSkillsByCategory(options.category).slice(
        0,
        options.limit ?? 10,
      );
    }
    return TAXONOMY_SKILLS.slice(0, options?.limit ?? 10);
  }

  const limit = options?.limit ?? 10;
  const filtered = options?.strictCategory && options?.category
    ? TAXONOMY_SKILLS.filter((s) => s.category === options.category)
    : TAXONOMY_SKILLS;

  interface Ranked {
    skill: TaxonomySkill;
    score: number;
  }

  const scored: Ranked[] = [];

  for (const skill of filtered) {
    const normName = normalizeSearchTerm(skill.name);
    const normId = skill.id;
    const categoryBoost = options?.category && skill.category === options.category ? 15 : 0;

    // Rank 1: Exact match on name or ID
    if (normName === normQuery || normId === normQuery) {
      scored.push({ skill, score: 100 + categoryBoost });
      continue;
    }

    // Rank 2: Prefix match on name
    if (normName.startsWith(normQuery)) {
      scored.push({ skill, score: 90 + categoryBoost });
      continue;
    }

    // Rank 3: Exact match on an alias
    const exactAlias = skill.aliases.some(
      (a) => normalizeSearchTerm(a) === normQuery,
    );
    if (exactAlias) {
      scored.push({ skill, score: 85 + categoryBoost });
      continue;
    }

    // Rank 4: Prefix match on an alias
    const prefixAlias = skill.aliases.some((a) =>
      normalizeSearchTerm(a).startsWith(normQuery),
    );
    if (prefixAlias) {
      scored.push({ skill, score: 75 + categoryBoost });
      continue;
    }

    // Rank 5: Word boundary match inside name
    if (normName.includes(` ${normQuery}`)) {
      scored.push({ skill, score: 60 + categoryBoost });
      continue;
    }

    // Rank 6: Substring match inside name or aliases
    if (
      normName.includes(normQuery) ||
      skill.aliases.some((a) => normalizeSearchTerm(a).includes(normQuery))
    ) {
      scored.push({ skill, score: 40 + categoryBoost });
      continue;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.skill);
}

/**
 * Returns all skills belonging to a specific category.
 */
export function getSkillsByCategory(category: SkillCategory): TaxonomySkill[] {
  return TAXONOMY_SKILLS.filter((s) => s.category === category);
}

/**
 * Returns taxonomy category definitions and popular skills.
 */
export function getTaxonomyCategories(): SkillCategoryMeta[] {
  return SKILL_CATEGORIES;
}

/**
 * Parses individual skill names from a formatted description string.
 * Supports separators: "·", "•", ",", "|", ";", "\n".
 */
export function parseSkillsFromText(text: string): string[] {
  if (!text || !text.trim()) return [];

  const tokens = text
    .split(/[\·\•\,\|\;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Deduplicate case-insensitively while preserving original casing of first appearance
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const token of tokens) {
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(token);
    }
  }

  return unique;
}

/**
 * Formats an array of skill strings using the standard CV middle dot separator.
 */
export function formatSkillsList(
  skills: string[],
  separator: " · " | ", " = " · ",
): string {
  return skills.filter((s) => s.trim().length > 0).join(separator);
}

/**
 * Appends a new skill to an existing formatted text string without creating duplicates.
 * Preserves existing separator convention (" · " vs ", ").
 */
export function addSkillToText(
  currentText: string,
  newSkill: string,
  preferredSeparator?: " · " | ", ",
): string {
  const cleanSkill = newSkill.trim();
  if (!cleanSkill) return currentText;

  const existingSkills = parseSkillsFromText(currentText);
  const exists = existingSkills.some(
    (s) => s.toLowerCase() === cleanSkill.toLowerCase(),
  );

  if (exists) return currentText;

  const separator =
    preferredSeparator ||
    (currentText.includes(",") && !currentText.includes("·") ? ", " : " · ");

  if (existingSkills.length === 0) {
    return cleanSkill;
  }

  return `${currentText.trim()}${separator}${cleanSkill}`;
}

/**
 * Removes a skill from an existing formatted text string.
 */
export function removeSkillFromText(
  currentText: string,
  skillToRemove: string,
): string {
  const cleanRemove = skillToRemove.trim().toLowerCase();
  const existingSkills = parseSkillsFromText(currentText);

  const filtered = existingSkills.filter(
    (s) => s.toLowerCase() !== cleanRemove,
  );

  const separator =
    currentText.includes(",") && !currentText.includes("·") ? ", " : " · ";

  return filtered.join(separator);
}
