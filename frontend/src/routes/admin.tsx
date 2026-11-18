import { Link, redirect, useLoaderData } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { currentUser, getOrderHistory } from "@/lib/api";
import { itemPrice } from "@/lib/site";

export async function adminLoader() {
  if (!(await currentUser())) throw redirect("/auth?next=%2Fadmin");
  const data = await getOrderHistory();
  if (!data.admin) throw new Response("Administrator access required", { status: 403 });
  return data;
}

export function AdminPage() {
  const { orders } = useLoaderData() as Awaited<ReturnType<typeof adminLoader>>;
  const disputed = orders.filter((order) => order.status === "disputed");
  const held = orders.filter((order) => ["paid", "delivery_pending", "delivered"].includes(order.status));
  const released = orders.filter((order) => order.status === "released");
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">ADMIN</p><h1 className="section-title">Order oversight</h1><p className="mt-2 text-muted-foreground">Review held payments and disputes before the December 1 launch.</p></div>
        <Link to="/orders" className="text-sm font-semibold text-primary hover:underline">View order history</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Clock3} label="Payment held" value={held.length} />
        <Summary icon={AlertTriangle} label="Disputes" value={disputed.length} danger />
        <Summary icon={BadgeCheck} label="Released" value={released.length} />
      </div>
      <section className="space-y-3"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="text-xl font-bold">Needs attention</h2></div>{disputed.length ? <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">{disputed.map((order) => <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted"><div><p className="font-semibold">{order.title}</p><p className="mt-1 text-sm text-muted-foreground">Receiver: {order.buyer} · Delivery disputed</p></div><p className="font-bold text-primary">{itemPrice(order.amount)}</p></Link>)}</div> : <p className="rounded-xl border border-dashed border-border p-6 text-muted-foreground">No disputed orders need review.</p>}</section>
    </main>
  );
}

function Summary({ icon: Icon, label, value, danger = false }: { icon: typeof Clock3; label: string; value: number; danger?: boolean }) {
  return <section className="rounded-2xl border border-border bg-card p-5"><Icon className={danger ? "size-5 text-destructive" : "size-5 text-primary"} /><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-extrabold">{value}</p></section>;
}
