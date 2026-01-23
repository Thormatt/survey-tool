import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Video, MousePointer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

async function getSites(userId: string) {
  try {
    const sites = await db.site.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            recordings: true,
            pageTargets: true,
            surveyTriggers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sitesWithStats = await Promise.all(
      sites.map(async (site) => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentRecordings = await db.siteRecording.count({
          where: {
            siteId: site.id,
            startedAt: { gte: weekAgo },
          },
        });

        return {
          ...site,
          recordingsThisWeek: recentRecordings,
        };
      })
    );

    return sitesWithStats;
  } catch {
    return [];
  }
}

export default async function SitesPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
        <p className="text-[#6b6b7b]">Please sign in to view your sites.</p>
      </div>
    );
  }

  const sites = await getSites(userId);

  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#6b6b7b] hover:text-[#1a1a2e] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-['Syne'] font-semibold text-lg">All Sites</h1>
          </div>
          <Link href="/sites/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Site
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {sites.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#dcd6f6] flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-[#1a1a2e]" />
              </div>
              <h3 className="font-['Syne'] text-lg font-semibold mb-2">No sites yet</h3>
              <p className="text-[#6b6b7b] mb-6 max-w-md mx-auto">
                Add your first website to start tracking sessions, generating heatmaps, and
                triggering surveys.
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
          <div className="space-y-4">
            {sites.map((site) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <Card className="hover:border-[#c9c1ed] transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-['Syne'] font-semibold text-lg">{site.name}</h3>
                          <Badge variant={site.enabled ? "highlight" : "secondary"}>
                            {site.enabled ? "Active" : "Disabled"}
                          </Badge>
                          {site.recordingEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <Video className="w-3 h-3 mr-1" />
                              Recordings
                            </Badge>
                          )}
                          {site.heatmapsEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <MousePointer className="w-3 h-3 mr-1" />
                              Heatmaps
                            </Badge>
                          )}
                        </div>
                        <p className="text-[#6b6b7b] text-sm mb-4">{site.domain}</p>
                        <div className="flex items-center gap-6 text-sm text-[#6b6b7b]">
                          <span className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            {site._count.recordings} recordings
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointer className="w-4 h-4" />
                            {site._count.pageTargets} page targets
                          </span>
                          <span>
                            {site.recordingsThisWeek} sessions this week
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
