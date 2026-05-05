import { AppShell } from "@/components/AppShell";
import { CampaignCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { campaigns } from "@/data/mock";

export default function InfaqPage() { return <AppShell active="/infaq"><PageHeader eyebrow="Infaq & Shadaqah" title="Campaign Kebaikan" /><section className="grid gap-4 lg:grid-cols-3">{campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}</section></AppShell>; }
