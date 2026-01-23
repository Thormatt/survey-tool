import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, BarChart3, Users, Globe, Video, MousePointer } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

async function getStats(userId: string) {
  try {
    const surveys = await db.survey.findMany({
      where: { userId },
      select: { id: true },
    });
    const surveyIds = surveys.map((s) => s.id);

    const [surveyCount, responseCount] = await Promise.all([
      db.survey.count({ where: { userId } }),
      db.response.count({ where: { surveyId: { in: surveyIds } } }),
    ]);
    return { surveyCount, responseCount };
  } catch {
    return { surveyCount: 0, responseCount: 0 };
  }
}

async function getRecentSurveys(userId: string) {
  try {
    return await db.survey.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { responses: true, questions: true } },
      },
    });
  } catch {
    return [];
  }
}

async function getSiteStats(userId: string) {
  try {
    const [siteCount, recordingCount] = await Promise.all([
      db.site.count({ where: { userId } }),
      db.siteRecording.count({
        where: { site: { userId } },
      }),
    ]);
    return { siteCount, recordingCount };
  } catch {
    return { siteCount: 0, recordingCount: 0 };
  }
}

async function getRecentSites(userId: string) {
  try {
    return await db.site.findMany({
      where: { userId },
      take: 3,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { recordings: true, pageTargets: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const user = await currentUser();
  const userId = user?.id || "";
  const [{ surveyCount, responseCount }, { siteCount, recordingCount }, recentSurveys, recentSites] = await Promise.all([
    getStats(userId),
    getSiteStats(userId),
    getRecentSurveys(userId),
    getRecentSites(userId),
  ]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg"
              alt="Andus Labs"
              width={32}
              height={32}
            />
            <span className="font-['Syne'] font-semibold text-lg">Survey</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/sites" className="text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              Sites
            </Link>
            <Link href="/surveys" className="text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              Surveys
            </Link>
            <Link href="/analytics" className="text-sm text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              Analytics
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-4">Beta</Badge>
          <h1 className="font-['Syne'] text-5xl font-bold leading-tight mb-6">
            {user ? (
              <>Welcome back, <span className="text-[#FF4F01]">{user.firstName || "there"}</span></>
            ) : (
              <>Create surveys that people <span className="text-[#FF4F01]">actually</span> want to complete</>
            )}
          </h1>
          <p className="text-[#6b6b7b] text-lg mb-8 leading-relaxed">
            Beautiful, intelligent surveys with branching logic, real-time analytics,
            and a completion experience your respondents will love.
          </p>
          <div className="flex gap-4">
            <Link href="/surveys/new">
              <Button size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Create Survey
              </Button>
            </Link>
            <Link href="/surveys">
              <Button variant="outline" size="lg">
                View All Surveys
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="hover:border-[#c9c1ed] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Total Sites</CardTitle>
              <Globe className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{siteCount}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">
                {siteCount === 0 ? "Add your first site" : "sites tracked"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[#c9c1ed] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Recordings</CardTitle>
              <Video className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{recordingCount}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">
                {recordingCount === 0 ? "No recordings yet" : "sessions recorded"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[#c9c1ed] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Total Surveys</CardTitle>
              <FileText className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{surveyCount}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">
                {surveyCount === 0 ? "Create your first survey" : "surveys created"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-[#c9c1ed] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6b6b7b]">Responses</CardTitle>
              <Users className="w-4 h-4 text-[#6b6b7b]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-['Syne'] font-bold">{responseCount}</div>
              <p className="text-xs text-[#6b6b7b] mt-1">
                {responseCount === 0 ? "Waiting for responses" : "responses collected"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Surveys Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-['Syne'] text-2xl font-semibold">Your Surveys</h2>
          <Link href="/surveys/new">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Survey
            </Button>
          </Link>
        </div>

        {recentSurveys.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No surveys yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Create your first survey to start collecting responses and insights from your audience.
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
            {recentSurveys.map((survey) => (
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
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {recentSurveys.length >= 5 && (
              <div className="text-center pt-4">
                <Link href="/surveys">
                  <Button variant="outline">View All Surveys</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent Sites Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-['Syne'] text-2xl font-semibold">Your Sites</h2>
          <Link href="/sites/new">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Site
            </Button>
          </Link>
        </div>

        {recentSites.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No sites yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Add your website to start tracking sessions, generating heatmaps, and triggering surveys.
              </p>
              <Link href="/sites/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Site
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentSites.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-['Syne'] font-semibold">{site.name}</h3>
                      <Badge variant={site.enabled ? "highlight" : "secondary"}>
                        {site.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-[#6b6b7b] text-sm mb-3">{site.domain}</p>
                    <div className="flex items-center gap-4 text-sm text-[#6b6b7b]">
                      <span className="flex items-center gap-1">
                        <Video className="w-4 h-4" />
                        {site._count.recordings}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="w-4 h-4" />
                        {site._count.pageTargets} targets
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {recentSites.length > 0 && (
          <div className="text-center pt-6">
            <Link href="/sites">
              <Button variant="outline">View All Sites</Button>
            </Link>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#dcd6f6] mt-20">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="https://cdn.prod.website-files.com/686e52cd9c00136ae69ac4d6/68751c8e13a5456b2330eb95_andus-sun-1.svg"
                alt="Andus Labs"
                width={24}
                height={24}
              />
              <span className="font-['Syne'] font-medium text-sm">Survey</span>
            </div>
            <p className="text-sm text-[#6b6b7b]">
              Powered by Andus Labs
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
