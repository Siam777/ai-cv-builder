import { parseTextToResume } from "@/lib/importers/text-resume-parser";
import { analyzeFile } from "@/lib/server/file-extraction";
import { readFileUpload } from "@/lib/server/file-upload";
import { HttpError, json, requireSameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { file } = await readFileUpload(request);
    const diagnostics = await analyzeFile(file);
    if (!diagnostics.text.trim())
      throw new HttpError(
        422,
        "NO_TEXT",
        "No readable text was extracted. Scanned/image-only files need OCR, which is not supported.",
      );
    const { document, warnings } = parseTextToResume(
      diagnostics.text,
      file.name,
    );
    warnings.unshift(
      "Review the parsed content against the extracted text and original file. Section mapping can omit or misclassify facts.",
    );
    if (diagnostics.file.format !== "txt")
      warnings.unshift(
        "File extraction reports this parser's text stream; visual reading order and ATS acceptance are not verified. Scanned pages are not supported.",
      );
    return json({
      success: true,
      document,
      warnings,
      diagnostics,
      extractedCharacterCount: diagnostics.text.length,
    });
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message, code: error.code }, error.status);
    return json(
      {
        error:
          "This file could not be processed. Try an unencrypted PDF, DOCX or UTF-8 TXT file.",
      },
      422,
    );
  }
}
