import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Placeholder from './pages/Placeholder';

import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './components/AuthContext';
import {
    GuestRoute,
    PlatformRoute,
    PortalRoute,
    RequirePermission,
    RootRedirect,
    StaffRoute,
} from './components/RouteGuards';
import '../css/app.css';

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

// Google sign-in only exists when the Client ID is set (Shahed will give it).
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function WithGoogle({ children }: { children: React.ReactNode }) {
    if (!GOOGLE_ID) return <>{children}</>;
    return <GoogleOAuthProvider clientId={GOOGLE_ID}>{children}</GoogleOAuthProvider>;
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <WithGoogle>
                <ThemeProvider>
                    <AuthProvider>
                        <BrowserRouter>
                            <Routes>
                                <Route path="/" element={<RootRedirect />} />

                                {/* Not signed in */}
                                <Route element={<GuestRoute />}>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/signup" element={<SignUp />} />
                                    <Route path="/forgot-password" element={<ForgotPassword />} />
                                </Route>

                                {/* Agency staff: Owner, Manager, Employee */}
                                <Route element={<StaffRoute />}>
                                    <Route path="/dashboard" element={<Dashboard />} />
                                    <Route
                                        path="/team"
                                        element={
                                            <RequirePermission perm="users.view">
                                                <Team />
                                            </RequirePermission>
                                        }
                                    />
                                </Route>

                                {/* The client's own login */}
                                <Route element={<PortalRoute />}>
                                    <Route
                                        path="/portal"
                                        element={
                                            <Placeholder
                                                title="Client portal"
                                                note="This is where you will review and approve content. We are building it next."
                                            />
                                        }
                                    />
                                </Route>

                                {/* Platform Admin */}
                                <Route element={<PlatformRoute />}>
                                    <Route
                                        path="/platform"
                                        element={
                                            <Placeholder
                                                title="Platform admin"
                                                note="The list of agencies and their subscriptions will be here."
                                            />
                                        }
                                    />
                                </Route>

                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </AuthProvider>
                </ThemeProvider>
            </WithGoogle>
        </QueryClientProvider>
    );
}

const container = document.getElementById('app');

if (container) {
    createRoot(container).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
