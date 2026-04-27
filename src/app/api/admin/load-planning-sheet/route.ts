/**
 * /api/admin/load-planning-sheet
 *
 * POST endpoint to upload and parse the planning sheet, loading masters.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadPlanningSheetMasters } from "@/lib/import/loadPlanningSheetMasters";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      return NextResponse.json(
        { error: "Only Excel files (.xlsx, .xls) are supported" },
        { status: 400 }
      );
    }

    // Load masters (this happens on the client in browser, but we can also process server-side if needed)
    // For now, we'll just validate and return a success message
    const metadata = await loadPlanningSheetMasters(file);

    return NextResponse.json({
      success: true,
      message: "Planning sheet masters loaded",
      metadata,
    });
  } catch (error) {
    console.error("Error loading planning sheet:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load planning sheet",
      },
      { status: 500 }
    );
  }
}
