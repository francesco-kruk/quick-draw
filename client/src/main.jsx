import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Homepage from "./routes/homepage/Homepage";
import DashboardPage from "./routes/dashboardPage/DashboardPage";
import DecksPage from "./routes/decksPage/DecksPage";
import DeckDetailPage from "./routes/deckDetailPage/DeckDetailPage";
import SettingsPage from "./routes/settingsPage/SettingsPage";
import SignInPage from "./routes/signInPage/SignInPage";
import SignUpPage from "./routes/signUpPage/SignUpPage";
import StudyPage from "./routes/studyPage/StudyPage";
import DashboardLayout from "./layouts/DashboardLayout";
import { AuthProvider } from "./lib/AuthContext";
import RequireAuth from "./lib/RequireAuth";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Homepage />,
  },
  {
    path: "/sign-in/*",
    element: <SignInPage />,
  },
  {
    path: "/sign-up/*",
    element: <SignUpPage />,
  },
  {
    // Pathless layout route to share DashboardLayout across multiple top-level paths
    element: (
      <RequireAuth>
        <DashboardLayout />
      </RequireAuth>
    ),
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/decks", element: <DecksPage /> },
      { path: "/decks/:deckId", element: <DeckDetailPage /> },
      { path: "/decks/:deckId/:cardId", element: <DeckDetailPage /> },
      { path: "/study/:deckId", element: <StudyPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);