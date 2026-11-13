import type { RouteObject } from "react-router-dom";
import { RootLayout, NotFoundPage, RouteError } from "./routes/__root";
import { StoryPage } from "./routes/story";
import { HowItWorksPage } from "./routes/how-it-works";
import { Index } from "./routes/index";
import { AuthPage } from "./routes/auth";
import { ItemDetail } from "./routes/items.$id";
import { GivePage } from "./routes/give";
import { DashboardPage, dashboardLoader } from "./routes/dashboard";
import { ProtectedLayout } from "./routes/protected";
import { listItems, findItem } from "./lib/api";

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: (
      <p role="status" className="px-4 py-20 text-center text-muted-foreground">
        Loading DoingGood…
      </p>
    ),
    children: [
      { index: true, loader: listItems, element: <Index />, errorElement: <RouteError /> },
      { path: "how-it-works", element: <HowItWorksPage /> },
      { path: "our-story", element: <StoryPage /> },
      {
        path: "privacy",
        lazy: async () => ({ Component: (await import("./routes/legal")).PrivacyPage }),
      },
      {
        path: "terms",
        lazy: async () => ({ Component: (await import("./routes/legal")).TermsPage }),
      },
      { path: "auth", element: <AuthPage /> },
      { path: "contact", lazy: async () => ({ Component: (await import("./routes/contact")).ContactPage }) },
      {
        path: "cart",
        lazy: async () => {
          const cart = await import("./routes/cart");
          return { Component: cart.CartPage, loader: cart.cartLoader };
        },
        errorElement: <RouteError />,
      },
      {
        path: "items/:id",
        loader: async ({ params }) => {
          const item = await findItem(params["id"]!);
          if (!item) throw new Response("Item not found", { status: 404 });
          return item;
        },
        element: <ItemDetail />,
        errorElement: <RouteError />,
      },
      {
        element: <ProtectedLayout />,
        children: [
          {
            path: "orders",
            lazy: async () => {
              const history = await import("./routes/order-history");
              return { Component: history.OrderHistoryPage, loader: history.orderHistoryLoader };
            },
            errorElement: <RouteError />,
          },
          {
            path: "wallet",
            lazy: async () => {
              const wallet = await import("./routes/wallet");
              return { Component: wallet.WalletPage, loader: wallet.walletLoader };
            },
          },
          ...["checkout", "checkout/:id"].map((path) => ({
            path,
            lazy: async () => {
              const checkout = await import("./routes/checkout");
              return { Component: checkout.CheckoutPage, loader: checkout.checkoutLoader };
            },
            errorElement: <RouteError />,
          })),
          {
            path: "payment/return",
            lazy: async () => {
              const payment = await import("./routes/payment-return");
              return { Component: payment.PaymentReturnPage, loader: payment.paymentReturnLoader };
            },
            errorElement: <RouteError />,
          },
          { path: "give", element: <GivePage /> },
          {
            path: "dashboard",
            loader: dashboardLoader,
            element: <DashboardPage />,
            errorElement: <RouteError />,
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
