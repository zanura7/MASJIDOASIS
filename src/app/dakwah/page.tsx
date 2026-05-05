import { AppShell } from "@/components/AppShell";
import { FeedCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { feeds } from "@/data/mock";

export default function DakwahPage() { return <AppShell active="/dakwah"><PageHeader eyebrow="Media Dakwah" title="Kajian dan Artikel" /><section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="space-y-3">{feeds.map(feed => <FeedCard key={feed.id} feed={feed} />)}</div></section></AppShell>; }
