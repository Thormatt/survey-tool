import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

// Force dynamic rendering to always show fresh data
export const dynamic = "force-dynamic";

async function getSurveys(userId: string) {
  try {
    const surveys = await db.survey.findMany({
      where: { userId },
      include: {
        _count: {
          select: { responses: true, questions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return surveys;
  } catch {
    return [];
  }
}

export default async function SurveysPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <p className="text-[#6b6b7b]">Please sign in to view your surveys.</p>
      </div>
    );
  }
  const surveys = await getSurveys(userId);

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      {/* Header */}
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">All Surveys</h1>
          </div>
          <Link href="/surveys/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Survey
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {surveys.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No surveys yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Create your first survey to start collecting responses.
              </p>
              <Link href="/surveys/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Survey
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {surveys.map((survey) => (
              <Link key={survey.id} href={`/surveys/${survey.id}`}>
                <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-['Syne'] font-semibold text-lg">
                            {survey.title}
                          </h3>
                          <Badge variant={survey.published ? "highlight" : "secondary"}>
                            {survey.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-[#6b6b7b] text-sm mb-4 line-clamp-2">
                          {survey.description || "No description"}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-[#6b6b7b]">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {survey._count.questions} questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {survey._count.responses} responses
                          </span>
                          <span>
                            Created {new Date(survey.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
