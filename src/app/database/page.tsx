"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformDatabase } from "@/components/database";
import "./database.css";

function DatabaseView() {
  const params = useSearchParams();
  const initial = params.get("slug") ?? params.get("id");
  return <PlatformDatabase initialId={initial} syncUrl />;
}

export default function DatabasePage() {
  return (
    <Suspense fallback={null}>
      <DatabaseView />
    </Suspense>
  );
}
