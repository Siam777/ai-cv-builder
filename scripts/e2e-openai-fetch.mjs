// Synthetic provider transport for the isolated dev test server only.
// The real adapter, request ledger, proposal decisions and database stay in use.
if (
  process.env.E2E_OPENAI !== "1" ||
  process.env.NODE_ENV === "production" ||
  process.env.TURSO_DATABASE_URL !== "file:./data/e2e.db" ||
  process.env.OPENAI_API_KEY !== "synthetic-openai-key" ||
  !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.APP_ORIGIN || "")
)
  throw new Error(
    "OpenAI transport fixture requires an isolated synthetic local test server.",
  );

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (new URL(url).hostname !== "api.openai.com")
    return originalFetch(input, init);
  if (url !== "https://api.openai.com/v1/responses")
    throw new Error("Unexpected synthetic OpenAI endpoint");
  const request = new Request(input, init);
  if (request.headers.get("authorization") !== "Bearer synthetic-openai-key")
    throw new Error("Unexpected provider credential");
  const body = await request.json();
  if (body.store !== false || body.tools || body.text?.format?.strict !== true)
    throw new Error("Unexpected provider request policy");
  const data = JSON.parse(body.input[0].content);
  let reply;
  switch (body.text.format.name) {
    case "resume_job_coaching_draft":
      reply = {
        text: "Conducted customer interviews about onboarding friction.",
        evidenceIds: [data.selected.id],
        message:
          data.instruction === "Controlled failed assessment audit"
            ? "Unverified credential claim"
            : "Inspect this controlled suggestion.",
        questions: [],
        assessment: {
          status: "relevant",
          explanation:
            "The entry describes interviews relevant to user research; qualification still needs review.",
          evidenceIds: [data.selected.id],
        },
      };
      break;
    case "resume_job_assessment_support":
      reply = {
        supported: data.message !== "Unverified credential claim",
        reason: "Controlled synthetic assessment verdict",
      };
      break;
    case "resume_job_rewrite_support":
      if (Object.keys(data).sort().join(",") !== "evidence,proposedText")
        throw new Error("Rewrite check received non-candidate context");
      reply = {
        supported: true,
        reason: "Controlled synthetic rewrite verdict",
      };
      break;
    case "cv_job_read": {
      // Job capture phase B: the request must carry only the post and link.
      if (Object.keys(data).sort().join(",") !== "post,url")
        throw new Error("Job read received more than the post and link");
      const has = (text) => data.post.includes(text);
      reply = {
        fields: {
          role: has("Data Analyst at Northwind Traders")
            ? { value: "Data Analyst", quote: "Data Analyst at Northwind Traders" }
            : { value: "", quote: "" },
          // A genuine quote with an invented company: the server drops it.
          company: has("Data Analyst at Northwind Traders")
            ? { value: "Contoso", quote: "Data Analyst at Northwind Traders" }
            : { value: "", quote: "" },
          location: { value: "", quote: "" },
          workType: has("Hybrid") ? { value: "hybrid", quote: "Hybrid" } : { value: "", quote: "" },
          employmentType: { value: "", quote: "" },
          salary: { value: "", quote: "" },
          deadline: { value: "", quote: "" },
          applyLink: { value: "", quote: "" },
        },
        requirements: has("3+ years of SQL")
          ? [
              { text: "3+ years of SQL", kind: "nice", quote: "3+ years of SQL" },
              { text: "Kubernetes", kind: "must", quote: "Kubernetes in production" },
            ]
          : [],
      };
      break;
    }
    case "cv_job_read_support":
      reply = { results: data.items.map((item) => ({ index: item.index, supported: true, reason: "Controlled synthetic verdict" })) };
      break;
    default:
      throw new Error("Unexpected synthetic provider schema");
  }
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(reply) }],
      },
    ],
  });
};
