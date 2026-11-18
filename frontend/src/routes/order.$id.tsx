import { Link, redirect, useLoaderData } from "react-router-dom";
import { currentUser, getOrderHistory } from "@/lib/api";
import { OrderCard } from "@/routes/order-history";

export async function orderDetailLoader({ params }: { params: Record<string, string | undefined> }) {
  const id = params["id"];
  if (!id) throw new Response("Order not found", { status: 404 });
  if (!(await currentUser())) throw redirect(`/auth?next=${encodeURIComponent(`/orders/${id}`)}`);
  const history = await getOrderHistory();
  const order = history.orders.find((entry) => entry.id === id);
  if (!order) throw new Response("Order not found", { status: 404 });
  return { ...history, order };
}

export function OrderDetailPage() {
  const { order, user_id } = useLoaderData() as Awaited<ReturnType<typeof orderDetailLoader>>;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
      <title>{order.title} | Order | DoingGood</title>
      <div>
        <Link to="/orders" className="text-sm font-medium text-primary hover:underline">← Back to order history</Link>
        <p className="eyebrow mt-6">ORDER DETAILS</p>
        <h1 className="mt-2 text-3xl font-extrabold">{order.title}</h1>
        <p className="mt-2 text-muted-foreground">This private order link is available only to the giver and receiver.</p>
      </div>
      <OrderCard order={order} user_id={user_id} />
    </main>
  );
}
