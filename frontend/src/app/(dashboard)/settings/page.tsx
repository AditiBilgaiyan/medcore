"use client";

import { DatabaseZap, Palette, ShieldCheck, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { AppearanceCard } from "@/components/modules/settings/appearance-card";
import { DemoResetCard } from "@/components/modules/settings/demo-reset-card";
import { PasswordCard } from "@/components/modules/settings/password-card";
import { ProfileCard } from "@/components/modules/settings/profile-card";
import { SessionsCard } from "@/components/modules/settings/sessions-card";
import { USE_MOCK_API } from "@/constants/config";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Settings" description="Manage your profile, security and preferences." className="pb-0" />
      <Tabs defaultValue="profile" className="gap-4">
        <div className="overflow-x-auto">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="profile">
              <UserRound aria-hidden /> Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <ShieldCheck aria-hidden /> Security
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette aria-hidden /> Appearance
            </TabsTrigger>
            {USE_MOCK_API && (
              <TabsTrigger value="demo">
                <DatabaseZap aria-hidden /> Demo data
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="profile" className="space-y-4">
          <ProfileCard />
        </TabsContent>
        <TabsContent value="security" className="space-y-4">
          <PasswordCard />
          <SessionsCard />
        </TabsContent>
        <TabsContent value="appearance" className="space-y-4">
          <AppearanceCard />
        </TabsContent>
        {USE_MOCK_API && (
          <TabsContent value="demo" className="space-y-4">
            <DemoResetCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
