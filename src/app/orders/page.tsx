import { AppShell } from "@/components/AppShell";
import { OrderCard } from "@/components/Cards";
import { PageHeader } from "@/components/PageHeader";
import { orders } from "@/data/mock";

export default function OrdersPage() { return <AppShell active="/orders"><PageHeader eyebrow="Riwayat Pesanan" title="Pantau Pesanan" /><section className="grid gap-4 lg:grid-cols-2">{orders.map(order => <OrderCard key={order.id} order={order} />)}</section></AppShell>; }
