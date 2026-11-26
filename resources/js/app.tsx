import React from 'react';
import { I18nProvider } from './services/i18n';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Team from './pages/Team';
import Content from './pages/Content';
import ContentDetail from './pages/ContentDetail';
import Approvals from './pages/Approvals';

import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './components/AuthContext';
import {
    GuestRoute,
    PlatformRoute,
    RequirePermission,
    RootRedirect,
    StaffRoute,
} from './components/RouteGuards';
import '../css/app.css';

import Assistant from './pages/Assistant';
import Portal from './pages/Portal';
import PortalReview from './pages/PortalReview';
import Tasks from './pages/Tasks';
import Media from './pages/Media';
import Reports from './pages/Reports';

import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import Recommendations from './pages/Recommendations';

import Platform from './pages/Platform';
import Campaigns from './pages/Campaigns';

import JoinInvite from './pages/JoinInvite';
import TeamJoin from './pages/TeamJoin';
import TeamAccess from './pages/TeamAccess';

import Requests from './pages/Requests';
import Publishing from './pages/Publishing';
import Profile from './pages/Profile';
import AiPolicy from './pages/AiPolicy';
import InsightsGuard from './components/InsightsGuard';
import AssistantGuard from './components/AssistantGuard';
import Renewals from './pages/Renewals';
import AuditLog from './pages/AuditLog';
import AgentPerformance from './pages/AgentPerformance';
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
                    <I18nProvider>
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
                                        <Route path="/profile" element={<Profile />} />
                                        <Route
                                            path="/publishing"
                                            element={
                                                <RequirePermission perm="content.view">
                                                    <Publishing />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/ai-policy"
                                            element={
                                                <RequirePermission perm="clients.update">
                                                    <AiPolicy />
                                                </RequirePermission>
                                            }
                                        />
                                                                                <Route
                                            path="/audit"
                                            element={
                                                <RequirePermission perm="audit.view">
                                                    <AuditLog />
                                                </RequirePermission>
                                            }
                                        />
                                                                                <Route
                                            path="/renewals"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <Renewals />
                                                </RequirePermission>
                                            }
                                        />
                                                                                <Route
                                            path="/ai-performance"
                                            element={
                                                <RequirePermission perm="reports.create">
                                                    <AgentPerformance />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/requests"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <Requests />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/team/access"
                                            element={
                                                <RequirePermission perm="users.create">
                                                    <TeamAccess />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route path="/dashboard" element={<Home />} />
                                        <Route
                                            path="/clients"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <Clients />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/clients/:id"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <ClientDetail />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/team"
                                            element={
                                                <RequirePermission perm="users.view">
                                                    <Team />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/content"
                                            element={
                                                <RequirePermission perm="content.view">
                                                    <Content />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/content/:id"
                                            element={
                                                <RequirePermission perm="content.view">
                                                    <ContentDetail />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/approvals"
                                            element={
                                                <RequirePermission perm="approvals.respond">
                                                    <Approvals />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/assistant"
                                            element={
                                                <RequirePermission perm="agents.run">
                                                    <AssistantGuard>
                                                        <Assistant />
                                                    </AssistantGuard>
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/tasks"
                                            element={
                                                <RequirePermission perm="tasks.view">
                                                    <Tasks />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/media"
                                            element={
                                                <RequirePermission perm="content.view">
                                                    <Media />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/reports"
                                            element={
                                                <RequirePermission perm="reports.view">
                                                    <Reports />
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/meetings"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <InsightsGuard>
                                                        <Meetings />
                                                    </InsightsGuard>
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/meetings/:id"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <InsightsGuard>
                                                        <MeetingDetail />
                                                    </InsightsGuard>
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/recommendations"
                                            element={
                                                <RequirePermission perm="clients.view">
                                                    <InsightsGuard>
                                                        <Recommendations />
                                                    </InsightsGuard>
                                                </RequirePermission>
                                            }
                                        />
                                        <Route
                                            path="/campaigns"
                                            element={
                                                <RequirePermission perm="campaigns.view">
                                                    <Campaigns />
                                                </RequirePermission>
                                            }
                                        />
                                    </Route>

                                    {/* The client's own login */}
                                    <Route path="/portal" element={<Portal />} />
                                    <Route path="/portal/content/:id" element={<PortalReview />} />

                                    {/* Platform Admin */}
                                    <Route element={<PlatformRoute />}>
                                        <Route path="/platform" element={<Platform />} />
                                    </Route>

                                    {/* Public pages (no sign-in) */}
                                    <Route path="/join/:token" element={<JoinInvite />} />
                                    <Route path="/team-join/:token" element={<TeamJoin />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </BrowserRouter>
                        </AuthProvider>
                    </I18nProvider>
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