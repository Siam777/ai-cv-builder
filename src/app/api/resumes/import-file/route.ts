import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/importers/pdf-text-extractor";
import { parseTextToResume } from "@/lib/importers/text-resume-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided or invalid file payload" },
        { status: 400 },
      );
    }

    if (file.size > 5_000_000) {
      return NextResponse.json(
        { error: "File exceeds maximum size of 5 MB" },
        { status: 413 },
      );
    }

    let textContent = "";
    const name = file.name.toLowerCase();

    if (name.endsWith(".pdf")) {
      const buffer = await file.arrayBuffer();
      textContent = extractTextFromPdf(buffer);
    } else {
      textContent = await file.text();
    }

    if (!textContent.trim()) {
      return NextResponse.json(
        { error: "Could not extract readable text from this file" },
        { status: 422 },
      );
    }

    const { document, warnings } = parseTextToResume(textContent, file.name);

    return NextResponse.json({
      success: true,
      document,
      warnings,
      extractedCharacterCount: textContent.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to parse resume file" },
      { status: 500 },
    );
  }
}
