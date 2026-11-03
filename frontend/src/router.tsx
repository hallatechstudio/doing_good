import { redirect, type RouteObject } from "react-router-dom";
import { RootLayout, NotFoundPage, RouteError } from "./routes/__root";
import { StoryPage } from "./routes/story";
import { HowItWorksPage } from "./routes/how-it-works";
import { ApiError, getOrders } from "./lib/api";
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
          { path: "give", element: <GivePage /> },
          {
            path: "orders",
            loader: async () => {
              try {
                return await getOrders();
              } catch (error) {
                if (error instanceof ApiError && error.status === 401)
                  throw redirect("/auth?next=%2Forders");
                throw error;
              }
            },
            lazy: async () => ({ Component: (await import("./routes/orders")).OrdersPage }),
            errorElement: <RouteError />,
          },
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
