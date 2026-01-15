"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-[#fbf5ea] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="font-['Syne'] text-2xl font-bold mb-3">
          Access Denied
        </h1>
        <p className="text-[#6b6b7b] mb-6">
          You don&apos;t have permission to access this application.
          Only authorized administrators can use the survey dashboard.
        </p>
        <Button
          onClick={() => signOut({ redirectUrl: "/" })}
          variant="outline"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
