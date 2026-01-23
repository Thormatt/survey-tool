import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SiteDashboardLoading() {
  return (
    <div className="min-h-screen bg-[#fbf5ea]">
      <header className="border-b border-[#dcd6f6]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-5 h-5" />
              <div>
                <Skeleton className="w-32 h-6 mb-1" />
                <Skeleton className="w-24 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-24 h-9" />
              <Skeleton className="w-24 h-9" />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div>
                    <Skeleton className="w-16 h-8 mb-1" />
                    <Skeleton className="w-24 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 text-center">
                <Skeleton className="w-8 h-8 mx-auto mb-3" />
                <Skeleton className="w-24 h-5 mx-auto mb-1" />
                <Skeleton className="w-16 h-4 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="w-24 h-6" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="w-48 h-4" />
                    <Skeleton className="w-16 h-5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="w-32 h-6" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <Skeleton className="w-32 h-4 mb-1" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                    <Skeleton className="w-16 h-5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
