import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PlanSelectionPage from "./pages/PlanSelectionPage";
import PaymentPage from "./pages/PaymentPage";
import DashboardPage from "./pages/DashboardPage";
import MyPolicyPage from "./pages/MyPolicyPage";
import ClaimsHistoryPage from "./pages/ClaimsHistoryPage";
import ProfilePage from "./pages/ProfilePage";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export default function App() {
    return (
        <>
            <Toaster position="top-center" reverseRide={false} />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/select-plan" element={<PlanSelectionPage />} />
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/policy" element={<MyPolicyPage />} />
                <Route path="/claims" element={<ClaimsHistoryPage />} />
                <Route path="/profile" element={<ProfilePage />} />
            </Routes>
        </>
    );
}
