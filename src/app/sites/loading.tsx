import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SitesLoading() {
  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="w-24 h-6" />
          </div>
          <Skeleton className="w-24 h-9" />
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="w-32 h-6" />
                      <Skeleton className="w-16 h-5" />
                    </div>
                    <Skeleton className="w-48 h-4 mb-4" />
                    <div className="flex items-center gap-6">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-32 h-4" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
