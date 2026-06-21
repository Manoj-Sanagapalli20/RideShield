import React, { useState, useEffect } from 'react';
import { 
  FiUsers, FiDollarSign, FiPercent, FiShield, FiActivity, 
  FiCheckCircle, FiXCircle, FiAlertTriangle, FiPlusCircle, 
  FiCalendar, FiMapPin, FiCompass, FiRefreshCw, FiGrid, FiArrowUpRight, FiSearch, FiGlobe,
  FiCloudRain, FiSun, FiLock, FiAlertOctagon
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'motion/react';

// Custom styling and formatter helpers for overrides log
const getOverrideBadgeStyle = (type) => {
  const t = (type || '').toLowerCase().trim();
  switch (t) {
    case 'strike':
    case 'bandh':
      return {
        bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        label: t === 'strike' ? 'Transport Strike' : 'Regional Bandh',
        icon: FiAlertTriangle
      };
    case 'curfew':
      return {
        bg: 'bg-red-500/10 border-red-500/20 text-red-400',
        label: 'Civil Curfew',
        icon: FiLock
      };
    case 'pollution':
      return {
        bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        label: 'Severe Pollution',
        icon: FiAlertOctagon
      };
    case 'rain':
      return {
        bg: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
        label: 'Heavy Monsoon',
        icon: FiCloudRain
      };
    case 'heat':
      return {
        bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
        label: 'Extreme Heatwave',
        icon: FiSun
      };
    default:
      return {
        bg: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
        label: t.toUpperCase(),
        icon: FiShield
      };
  }
};

const formatZoneName = (zoneStr) => {
  if (!zoneStr) return '';
  const parts = zoneStr.split('-');
  if (parts.length < 2) return zoneStr.charAt(0).toUpperCase() + zoneStr.slice(1);
  const place = parts[0];
  const pincode = parts[1];
  const capitalizedPlace = place
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `${capitalizedPlace} (${pincode})`;
};

// API Configurations
const PAYMENT_SERVICE_URL = 'http://localhost:5003';
const MAIN_SERVICE_URL = 'http://localhost:5005';

const SERVICES = [
  { name: 'Auth Service', port: 5001, key: 'auth' },
  { name: 'Policy Service', port: 5002, key: 'policy' },
  { name: 'Payment Service', port: 5003, key: 'payment' },
  { name: 'Address Polling', port: 5004, key: 'polling' },
  { name: 'Main Service', port: 5005, key: 'main' },
  { name: 'Notification Service', port: 3004, key: 'notification' },
  { name: 'ML Service', port: 8000, key: 'ml' }
];

// RideShield Logo component matching UserDashboard branding exactly
export function LogoSVG({ className = "text-primary-500" }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      fill="none" 
      className={className}
    >
      <defs>
        <linearGradient id="shieldGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <radialGradient id="shieldBgGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E1B18" />
          <stop offset="100%" stopColor="#090908" />
        </radialGradient>
      </defs>
      {/* Shield Background with Inner Glow */}
      <path 
        d="M 50,12 Q 33,14 22,21 C 22,51 30,76 50,93 C 70,76 78,51 78,21 Q 67,14 50,12 Z" 
        fill="url(#shieldBgGradient)" 
        stroke="url(#shieldGoldGradient)" 
        strokeWidth="5" 
        strokeLinejoin="round"
      />
      {/* Lightning Bolt inside shield */}
      <path 
        d="M 52,28 L 36,47 L 46,47 L 40,70 L 60,41 L 48,41 Z" 
        fill="url(#shieldGoldGradient)"
      />
      {/* Rain Cloud overlapping top right */}
      <path 
        d="M 62,35 C 60,35 59,33.5 59,32 C 59,28 62,25 66,25 C 67,21 71,18 76,18 C 81.5,18 86,22 86,27.5 C 86,28 85.9,28.5 85.8,29 C 88.2,29.5 90,31.5 90,34 C 90,37 87.5,39.5 84.5,39.5 L 62,39.5" 
        fill="url(#shieldGoldGradient)"
      />
      {/* Rain drops falling from cloud */}
      <path 
        d="M 66,45 L 64,49 M 73,46 L 71,50 M 80,45 L 78,49" 
        stroke="url(#shieldGoldGradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState({
    activeDriversCount: 0,
    totalPremiumsCollected: 0,
    totalClaimsPaid: 0,
    lossRatio: 0,
    pendingReviewsCount: 0
  });
  
  // Data States
  const [payouts, setPayouts] = useState([]);
  const [newsAlerts, setNewsAlerts] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [serviceHealth, setServiceHealth] = useState({});
  const [statusFilter, setStatusFilter] = useState('REVIEW');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Override Form State
  const [overrideDate, setOverrideDate] = useState(() => {
    const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istTime.getFullYear() + '-' + String(istTime.getMonth() + 1).padStart(2, '0') + '-' + String(istTime.getDate()).padStart(2, '0');
  });
  const [overrideCity, setOverrideCity] = useState('');
  const [overridePincode, setOverridePincode] = useState('');
  const [overrideType, setOverrideType] = useState('strike');
  
  // UI Loading States
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Detect if running locally (to toggle microservices ports checks)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Show inline toast notifications
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Analytics Data
  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/api/admin/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  };

  // Fetch Claims / Payouts List
  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'ALL' 
        ? `${PAYMENT_SERVICE_URL}/api/admin/payouts`
        : `${PAYMENT_SERVICE_URL}/api/admin/payouts?status=${statusFilter}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayouts(data.payouts || []);
      }
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
      showToast('Failed to load payouts queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch NewsAPI Strike/Curfew alerts for active zones
  const fetchNewsAlerts = async () => {
    setNewsLoading(true);
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/api/admin/news-alerts?date=${overrideDate}`);
      if (res.ok) {
        const data = await res.json();
        setNewsAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch news alerts:', err);
    } finally {
      setNewsLoading(false);
    }
  };

  // Fetch all registered drivers and policies
  const fetchDrivers = async () => {
    setDriversLoading(true);
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/api/admin/drivers`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch (err) {
      console.error('Failed to fetch drivers list:', err);
      showToast('Failed to load driver policies list', 'error');
    } finally {
      setDriversLoading(false);
    }
  };

  // Fetch active manual overrides list
  const fetchOverrides = async () => {
    try {
      const res = await fetch(`${MAIN_SERVICE_URL}/api/disruptions/overrides`);
      if (res.ok) {
        const data = await res.json();
        setOverrides(data.overrides || []);
      }
    } catch (err) {
      console.error('Failed to fetch overrides list:', err);
    }
  };

  // Check Microservices Health
  const checkHealth = async () => {
    if (!isLocalhost) return; // Skip in production environment
    
    const healthStatus = {};
    for (const service of SERVICES) {
      try {
        const url = `http://localhost:${service.port}/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        healthStatus[service.key] = res.ok ? 'ONLINE' : 'DEGRADED';
      } catch (err) {
        healthStatus[service.key] = 'OFFLINE';
      }
    }
    setServiceHealth(healthStatus);
  };

  // Run initial queries on startup and setup auto-polling
  useEffect(() => {
    fetchAnalytics();
    fetchPayouts();
    fetchOverrides();
    
    // Auto-poll metrics and claims every 10 seconds for real-time updates
    const pollInterval = setInterval(() => {
      fetchAnalytics();
      fetchPayouts();
      fetchOverrides();
    }, 10000);

    if (isLocalhost) {
      checkHealth();
      const healthInterval = setInterval(checkHealth, 30000);
      return () => {
        clearInterval(pollInterval);
        clearInterval(healthInterval);
      };
    }
    
    return () => clearInterval(pollInterval);
  }, [statusFilter]);

  // Fetch corresponding tab data
  useEffect(() => {
    if (activeTab === 'claims') fetchPayouts();
    if (activeTab === 'news') fetchNewsAlerts();
    if (activeTab === 'drivers') fetchDrivers();
    if (activeTab === 'overrides') fetchOverrides();
  }, [activeTab, statusFilter, overrideDate]);

  // Handle Claims Review (Approve / Reject)
  const handleReviewAction = async (id, status) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/api/admin/payouts/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      
      if (res.ok) {
        showToast(`Claim successfully ${status === 'PROCESSED' ? 'approved' : 'rejected'}`);
        fetchPayouts();
        fetchAnalytics();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to update claim status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error updating claim', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Submit Zone Override
  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideCity || !overridePincode || !overrideDate) {
      showToast('Please fill in all override fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${MAIN_SERVICE_URL}/api/disruptions/confirm-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: overrideDate,
          city: overrideCity.trim(),
          pincode: overridePincode.trim(),
          type: overrideType
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Override successfully confirmed!');
        setOverrideCity('');
        setOverridePincode('');
        fetchAnalytics();
        fetchOverrides();
        if (activeTab === 'news') fetchNewsAlerts();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to apply override', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error submitting override', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Revoke/Delete a manual zone override
  const handleRevokeOverride = async (key) => {
    if (!window.confirm('Are you sure you want to revoke this zone override? Claims for this region will revert to using standard weather/social feeds.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${MAIN_SERVICE_URL}/api/disruptions/overrides`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });

      if (res.ok) {
        showToast('Zone override revoked successfully!');
        fetchOverrides();
        fetchAnalytics();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to revoke override', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error revoking override', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Apply quick override from a News alert (calls live geocoder dynamically)
  const handleQuickOverride = async (alert) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/ml/geocode?city=${encodeURIComponent(alert.city)}`);
      if (res.ok) {
        const geoData = await res.json();
        if (geoData.success) {
          setOverrideCity(alert.city);
          setOverridePincode(geoData.pincode || '520001'); // Fallback if postcode not returned
          setOverrideType(alert.type);
          setActiveTab('overrides');
          showToast(`Quick-filled override using geocoded zone coordinates for ${alert.city}.`);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to geocode city dynamically:', err);
    }
    // Fallback if geocoding fails
    setOverrideCity(alert.city);
    setOverridePincode('520001');
    setOverrideType(alert.type);
    setActiveTab('overrides');
    showToast(`Quick-filled override for ${alert.city} with default pincode.`);
    setLoading(false);
  };

  // Toggle Policy status between active/paused
  const handleTogglePolicyStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'SUCCESS' ? 'PAUSED' : 'SUCCESS';
    setActionLoadingId(userId);
    try {
      const res = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: nextStatus })
      });
      if (res.ok) {
        showToast(`Policy status updated to ${nextStatus === 'SUCCESS' ? 'ACTIVE' : 'PAUSED'}`);
        fetchDrivers();
      } else {
        showToast('Failed to update policy status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating policy status', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Search filter
  const filteredPayouts = payouts.filter(p => 
    p.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d => 
    d.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.email && d.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-black text-slate-100 flex font-poppins relative overflow-hidden">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 font-semibold ${
              toast.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {toast.type === 'error' ? <FiAlertTriangle className="size-5 shrink-0" /> : <FiCheckCircle className="size-5 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] size-[50vw] rounded-full bg-primary-950/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] size-[50vw] rounded-full bg-emerald-950/5 blur-[120px] pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-black border-r border-white/5 p-6 flex flex-col justify-between z-10 shrink-0">
        <div>
          {/* Logo Branding */}
          <div className="px-1 pb-5 border-b border-white/5 mb-8">
            <div className="flex items-center gap-3">
              <LogoSVG className="size-8 shrink-0" />
              <div>
                <span className="text-lg font-semibold text-white tracking-tight">
                  RideShield
                </span>
                <span className="text-[10px] text-primary-400 font-bold block tracking-widest leading-none uppercase mt-0.5">
                  Admin Terminal
                </span>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            {[
              { id: 'analytics', label: 'Overview & Analytics', icon: FiGrid },
              { id: 'claims', label: 'Claims Queue', icon: FiActivity, badge: analytics.pendingReviewsCount },
              { id: 'overrides', label: 'Zone Overrides', icon: FiCompass },
              { id: 'news', label: 'News Alerts Feed', icon: FiGlobe },
              { id: 'drivers', label: 'Driver Policies', icon: FiUsers }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSearchTerm('');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-semibold group text-left border ${
                    isActive 
                      ? "bg-primary-600/20 text-primary-400 border-primary-500/20"
                      : "text-slate-500 hover:text-white hover:bg-white/5 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4.5" />
                    <span className="text-[13px]">{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info / Status summary */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
              ZM
            </div>
            <div>
              <p className="text-xs font-bold text-white">Zone Manager</p>
              <p className="text-[10px] text-slate-500 font-medium">Operations Control</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 p-10 overflow-y-auto z-10 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0">
              {activeTab === 'analytics' && 'Operational Analytics'}
              {activeTab === 'claims' && 'Claims Queue Manager'}
              {activeTab === 'overrides' && 'Manual Zone Overrides'}
              {activeTab === 'news' && 'News Alerts Feed'}
              {activeTab === 'drivers' && 'Driver Policies List'}
            </h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {activeTab === 'analytics' && 'Global parametric performance and loss ratios'}
              {activeTab === 'claims' && 'Flagged claims requiring manual audit decision'}
              {activeTab === 'overrides' && 'Publish manual strike & weather triggers per zone'}
              {activeTab === 'news' && 'Automated NewsAPI keyword detection for curfew/strikes'}
              {activeTab === 'drivers' && 'Manage subscription plans, premiums, and policies'}
            </p>
          </div>
          
          {/* Global Actions */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                fetchAnalytics();
                fetchPayouts();
                if (activeTab === 'news') fetchNewsAlerts();
                if (activeTab === 'drivers') fetchDrivers();
                if (isLocalhost) checkHealth();
                showToast('Terminal data re-synchronized');
              }}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Refresh Data"
            >
              <FiRefreshCw className="size-4" />
            </button>
          </div>
        </header>

        {/* Tab Contents */}
        <div className="flex-1">
          
          {/* TAB 1: ANALYTICS & OVERVIEW */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              
              {/* Metrics Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {[
                  { 
                    label: 'Active Driver Enrolments', 
                    value: analytics.activeDriversCount, 
                    icon: FiUsers,
                    color: 'text-primary-400' 
                  },
                  { 
                    label: 'Total Premiums Earned', 
                    value: `₹${analytics.totalPremiumsCollected.toLocaleString()}`, 
                    icon: FiDollarSign,
                    color: 'text-emerald-400' 
                  },
                  { 
                    label: 'Total Claims Disbursed', 
                    value: `₹${analytics.totalClaimsPaid.toLocaleString()}`, 
                    icon: FiCompass,
                    color: 'text-blue-400' 
                  },
                  { 
                    label: 'Loss Ratio', 
                    value: `${analytics.lossRatio}%`, 
                    icon: FiPercent,
                    color: analytics.lossRatio > 100 
                      ? 'text-red-400' 
                      : analytics.lossRatio > 75 
                        ? 'text-amber-400' 
                        : 'text-primary-400',
                    isLossRatio: true
                  }
                ].map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div key={idx} className="bg-black border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">
                          {card.label}
                        </span>
                        <Icon className={`size-5 ${card.color}`} />
                      </div>
                      <h2 className="text-2xl font-black text-white m-0 tracking-tight">
                        {card.value}
                      </h2>
                      {card.isLossRatio && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className={`size-2 rounded-full ${
                            analytics.lossRatio > 100 
                              ? 'bg-red-500 animate-pulse' 
                              : analytics.lossRatio > 75 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                          }`} />
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {analytics.lossRatio > 100 
                              ? 'Critical Underwriting Loss' 
                              : analytics.lossRatio > 75 
                                ? 'Warning: High Claims' 
                                : 'Healthy Profit Margin'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Central Section: Local Health Check (Conditional) or System Info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Microservice Health Section */}
                <div className="bg-black border border-white/5 rounded-2xl p-6 lg:col-span-2 shadow-sm">
                  {isLocalhost ? (
                    <>
                      <div className="flex items-center gap-3 mb-6">
                        <FiActivity className="size-5 text-primary-400" />
                        <div>
                          <h3 className="text-sm font-black text-white">Local Service Port Diagnostic</h3>
                          <p className="text-[10px] text-slate-500 font-medium">Verifying active local processes (Localhost Mode)</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SERVICES.map(srv => {
                          const health = serviceHealth[srv.key];
                          return (
                            <div key={srv.key} className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                              <div>
                                <p className="text-xs font-bold text-white leading-tight">{srv.name}</p>
                                <p className="text-[9px] text-slate-500 font-medium uppercase mt-0.5">Port {srv.port}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${
                                  health === 'ONLINE' 
                                    ? 'bg-emerald-500' 
                                    : health === 'DEGRADED' 
                                      ? 'bg-amber-500 animate-pulse' 
                                      : 'bg-red-500 animate-pulse'
                                }`} />
                                <span className={`text-[10px] font-extrabold ${
                                  health === 'ONLINE' 
                                    ? 'text-emerald-400' 
                                    : health === 'DEGRADED' 
                                      ? 'text-amber-400' 
                                      : 'text-red-400'
                                }`}>
                                  {health || 'LOADING...'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    // Production Status Screen
                    <div className="h-full flex flex-col justify-center py-6">
                      <div className="flex items-center gap-3 mb-4">
                        <FiCheckCircle className="size-6 text-emerald-400" />
                        <div>
                          <h3 className="text-sm font-black text-white">Production Gateway Operational</h3>
                          <p className="text-[10px] text-slate-500 font-medium">All cloud instances connected and load balanced</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-md">
                        RideShield Services are deployed via secure docker containers. Internal port telemetry is automatically handled by the orchestrator.
                      </p>
                      
                      <div className="mt-6 flex items-center gap-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          API Gateway: Online
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          DB Cluster: Stable
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Insurer Actions Overview */}
                <div className="bg-black border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                  <div>
                    <h3 className="text-sm font-black text-white mb-2">Claim Queue Activity</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      RideShield uses an unsupervised **Isolation Forest model** (ML Engine) to cross-verify claims. If it flags spatial or cellular anomalies, the claims are quarantined.
                    </p>
                    
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <span className="text-xs text-slate-500 font-semibold">Reviews Awaiting Decision</span>
                        <span className="text-xs font-bold text-white">{analytics.pendingReviewsCount}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <span className="text-xs text-slate-500 font-semibold">Insured Core Drivers</span>
                        <span className="text-xs font-bold text-white">{analytics.activeDriversCount}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('claims')}
                    className="w-full mt-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Open Claims Queue <FiArrowUpRight className="size-4 stroke-[2.5]" />
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: CLAIMS QUEUE MANAGER */}
          {activeTab === 'claims' && (
            <div className="space-y-6">
              
              {/* Table Toolbar controls */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-black border border-white/5 p-4 rounded-xl shadow-sm">
                
                {/* Filters */}
                <div className="flex items-center gap-2 shrink-0">
                  {['REVIEW', 'PROCESSED', 'REJECTED', 'ALL'].map(filterVal => (
                    <button
                      key={filterVal}
                      onClick={() => setStatusFilter(filterVal)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        statusFilter === filterVal
                          ? 'bg-primary-500/20 text-primary-400 border-primary-500/20'
                          : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      {filterVal === 'REVIEW' && '⚠️ Pending Audit'}
                      {filterVal === 'PROCESSED' && '✅ Approved'}
                      {filterVal === 'REJECTED' && '❌ Rejected'}
                      {filterVal === 'ALL' && 'Show All'}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-72">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                  <input
                    type="text"
                    placeholder="Search by driver ID or reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-white/5 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>

              {/* Claims Queue list */}
              <div className="bg-black border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <FiRefreshCw className="size-6 text-slate-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-bold">Querying ledger records...</p>
                  </div>
                ) : filteredPayouts.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500">No claim records matched your query.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.01]">
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Driver ID</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Plan</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Date</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Claim Reason</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Payout</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Audit Status</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredPayouts.map(payout => {
                          const isPending = payout.status === 'REVIEW';
                          const isHighPriority = payout.priority === 'high';
                          
                          // Structured reason parsing helper
                          const parseAuditReason = (reasonStr) => {
                            if (!reasonStr) return { main: "", flags: [], isAudit: false, anomalyScore: null, metrics: null };
                            
                            // Check for structured review reason with metrics
                            const auditMatch = reasonStr.match(/^Pending Audit \(Anomaly Score: ([0-9.]+)\)\. Flagged for: (.*?)\. Metrics -> (.*?)\. Claim Details: (.*)$/);
                            if (auditMatch) {
                              const metricsStr = auditMatch[3];
                              const gpsMatch = metricsStr.match(/GPS Match: (\d+)/)?.[1] || "";
                              const motion = metricsStr.match(/Motion: ([0-9.]+)/)?.[1] || "";
                              const loginGap = metricsStr.match(/Login Gap: (\d+m)/)?.[1] || "";
                              const orders = metricsStr.match(/Orders: (\d+)/)?.[1] || "";
                              const claims30d = metricsStr.match(/Claims 30d: (\d+)/)?.[1] || "";
                              const neighbors = metricsStr.match(/Neighbors: (\d+)/)?.[1] || "";
                              const cohort = metricsStr.match(/Cohort: (\d+)/)?.[1] || "";
                              const fingerprint = metricsStr.match(/Fingerprint: ([0-9.]+)/)?.[1] || "";

                              return {
                                isAudit: true,
                                anomalyScore: parseFloat(auditMatch[1]),
                                flags: auditMatch[2].split(" | ").map(f => f.trim()).filter(Boolean),
                                metrics: { gpsMatch, motion, loginGap, orders, claims30d, neighbors, cohort, fingerprint },
                                main: auditMatch[4]
                              };
                            }

                            // Fallback for simple structured review reason
                            const simpleAuditMatch = reasonStr.match(/^Pending Audit \(Anomaly Score: ([0-9.]+)\)\. Flagged for: (.*?)\. Claim Details: (.*)$/);
                            if (simpleAuditMatch) {
                              return {
                                isAudit: true,
                                anomalyScore: parseFloat(simpleAuditMatch[1]),
                                flags: simpleAuditMatch[2].split(" | ").map(f => f.trim()).filter(Boolean),
                                metrics: null,
                                main: simpleAuditMatch[3]
                              };
                            }

                            // Check for legacy/mock trigger format:
                            // "Flagged: High Device Fingerprint Cluster Score (Anomaly Score: 0.42)"
                            const legacyMatch = reasonStr.match(/^Flagged: (.*?) \(Anomaly Score: ([0-9.]+)\)$/i);
                            if (legacyMatch) {
                              return {
                                isAudit: true,
                                anomalyScore: parseFloat(legacyMatch[2]),
                                flags: [legacyMatch[1].trim()],
                                metrics: null,
                                main: "Legacy Test Claim"
                              };
                            }

                            // Check for standard anomaly score matches in the text
                            const anyAnomalyMatch = reasonStr.match(/Anomaly Score: ([0-9.]+)/i);
                            const anyScore = anyAnomalyMatch ? parseFloat(anyAnomalyMatch[1]) : null;
                            
                            return {
                              isAudit: anyScore !== null,
                              anomalyScore: anyScore,
                              flags: [],
                              metrics: null,
                              main: reasonStr
                            };
                          };

                          const parsed = parseAuditReason(payout.reason);
                          const anomalyScore = parsed.anomalyScore;

                          return (
                            <tr key={payout._id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-mono text-xs font-bold text-white">{payout.userId}</span>
                                {isHighPriority && (
                                  <span className="ml-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
                                    ⚡ PRO Priority
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-400">
                                {isHighPriority ? 'Pro Plan' : 'Standard'}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-400 font-mono">
                                {payout.date}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-300 max-w-md whitespace-normal leading-relaxed">
                                <div className="space-y-1.5">
                                  {/* Main Disruption Reason */}
                                  <div className="font-semibold text-slate-200">
                                    {parsed.main}
                                  </div>
                                  
                                  {/* ML Fraud Flags */}
                                  {parsed.isAudit && parsed.flags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {parsed.flags.map((flag, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded w-fit">
                                          <span>⚠️</span>
                                          <span>{flag}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Metrics Grid */}
                                  {parsed.isAudit && parsed.metrics && (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-slate-400 font-medium">
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>GPS Match:</span>
                                        <span className={parsed.metrics.gpsMatch === '1' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                          {parsed.metrics.gpsMatch === '1' ? 'Yes' : 'No'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>Device Motion:</span>
                                        <span className={parseFloat(parsed.metrics.motion) < 0.4 ? 'text-red-400 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.motion}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>Login to Claim:</span>
                                        <span className={parseInt(parsed.metrics.loginGap) < 60 ? 'text-red-450 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.loginGap}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>Orders (3hr):</span>
                                        <span className={parseInt(parsed.metrics.orders) <= 1 ? 'text-red-400 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.orders}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>Claims (30d):</span>
                                        <span className={parseInt(parsed.metrics.claims30d) >= 2 ? 'text-red-400 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.claims30d}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b border-white/5 pb-1">
                                        <span>Fingerprint Score:</span>
                                        <span className={parseFloat(parsed.metrics.fingerprint) > 0.25 ? 'text-red-450 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.fingerprint}
                                        </span>
                                      </div>
                                      <div className="flex justify-between pb-0.5">
                                        <span>Neighbors (Claims):</span>
                                        <span className={parseInt(parsed.metrics.neighbors) < 5 ? 'text-red-400 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.neighbors}
                                        </span>
                                      </div>
                                      <div className="flex justify-between pb-0.5">
                                        <span>Cohort Size:</span>
                                        <span className={parseInt(parsed.metrics.cohort) >= 15 ? 'text-red-400 font-bold' : 'text-slate-200 font-bold'}>
                                          {parsed.metrics.cohort}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-white font-mono text-xs">
                                ₹{payout.amount.toFixed(2)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className={`size-1.5 rounded-full ${
                                    payout.status === 'REVIEW' 
                                      ? 'bg-amber-500 animate-pulse' 
                                      : payout.status === 'PROCESSED' 
                                        ? 'bg-emerald-500' 
                                        : 'bg-red-500'
                                  }`} />
                                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                                    payout.status === 'REVIEW' 
                                      ? 'text-amber-400' 
                                      : payout.status === 'PROCESSED' 
                                        ? 'text-emerald-400' 
                                        : 'text-red-400'
                                  }`}>
                                    {payout.status === 'REVIEW' ? 'Pending Review' : payout.status}
                                  </span>
                                </div>
                                {anomalyScore !== null && (
                                  <div className="mt-0.5 text-[9px] font-bold text-slate-500">
                                    ML score: <span className={anomalyScore > 0.4 ? 'text-red-400' : 'text-amber-400'}>{anomalyScore}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isPending ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      disabled={actionLoadingId === payout._id}
                                      onClick={() => handleReviewAction(payout._id, 'PROCESSED')}
                                      className="px-2.5 py-1 rounded bg-primary-500 hover:bg-primary-600 text-black text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      disabled={actionLoadingId === payout._id}
                                      onClick={() => handleReviewAction(payout._id, 'REJECTED')}
                                      className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                                    Audited
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: MANUAL ZONE OVERRIDES */}
          {activeTab === 'overrides' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form Input Area & Active Overrides log */}
              <div className="space-y-6 lg:col-span-2">
                <div className="bg-black border border-white/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <FiPlusCircle className="size-5 text-primary-400" />
                    <div>
                      <h3 className="text-sm font-black text-white">Create Social Disruption Override</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Bypass automated data checking for specific municipal zones</p>
                    </div>
                  </div>

                  <form onSubmit={handleOverrideSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Date */}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Disruption Date</label>
                        <div className="relative">
                          <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                          <input
                            type="date"
                            value={overrideDate}
                            onChange={(e) => setOverrideDate(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Disruption Type */}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Override Event Type</label>
                        <div className="relative">
                          <FiCompass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                          <select
                            value={overrideType}
                            onChange={(e) => setOverrideType(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500 appearance-none"
                          >
                            <option value="strike">🚚 Transport Strike (Hartal)</option>
                            <option value="curfew">🚨 Civil Curfew / Restrictions</option>
                            <option value="bandh">⛔ Regional Bandh / Protest</option>
                            <option value="pollution">🌫️ Severe Air Pollution (AQI &gt; 300)</option>
                            <option value="rain">🌧️ Heavy Monsoon / Torrential Rain</option>
                            <option value="heat">🥵 Extreme Heatwave (&gt; 45°C)</option>
                          </select>
                        </div>
                      </div>

                      {/* City */}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">City Name</label>
                        <div className="relative">
                          <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                          <input
                            type="text"
                            placeholder="e.g. Vijayawada"
                            value={overrideCity}
                            onChange={(e) => setOverrideCity(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500 placeholder-slate-650"
                            required
                          />
                        </div>
                      </div>

                      {/* Pincode */}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Zone Pincode</label>
                        <div className="relative">
                          <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                          <input
                            type="text"
                            placeholder="e.g. 520001"
                            value={overridePincode}
                            onChange={(e) => setOverridePincode(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary-500 placeholder-slate-650 font-mono"
                            required
                          />
                        </div>
                      </div>

                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-black font-extrabold text-xs uppercase tracking-wide transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? 'Publishing override...' : 'Publish Manual Strike Override'}
                      <FiArrowUpRight className="size-4 stroke-[2.5]" />
                    </button>
                  </form>
                </div>

                {/* Overrides Log Card */}
                <div className="bg-black border border-white/5 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <FiActivity className="size-5 text-primary-400" />
                      <div>
                        <h3 className="text-sm font-black text-white">Active Zone Overrides Log</h3>
                        <p className="text-[10px] text-slate-500 font-medium">Review manual overrides currently registered in Redis cache</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 border border-white/10 rounded-full font-mono text-slate-400 bg-white/[0.02] font-semibold">
                      {overrides.length} Overrides
                    </span>
                  </div>

                  {overrides.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                      <FiCompass className="size-8 text-slate-600 mx-auto mb-2.5" />
                      <p className="text-xs font-bold text-slate-500">No manual overrides active in the system</p>
                      <p className="text-[10px] text-slate-600 mt-1">Use the form above to declare a local social or weather disruption</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      <AnimatePresence initial={false}>
                        {overrides.map((ovr) => {
                          const dateObj = new Date(ovr.createdAt);
                          const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                          const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                          
                          const badgeStyle = getOverrideBadgeStyle(ovr.type);
                          const OvrIcon = badgeStyle.icon;
                          
                          return (
                            <motion.div 
                              key={ovr.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -30 }}
                              transition={{ duration: 0.2 }}
                              className="flex flex-col md:flex-row md:items-center justify-between p-3.5 bg-white/[0.01] border border-white/5 rounded-xl hover:border-white/10 transition-all hover:bg-white/[0.02] group"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`${badgeStyle.bg} p-2 rounded-xl shrink-0 border`}>
                                  <OvrIcon size={16} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-white">{formatZoneName(ovr.zone)}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 border rounded font-mono font-extrabold uppercase tracking-wider ${badgeStyle.bg}`}>
                                      {badgeStyle.label}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 font-medium leading-none">
                                    Disruption Date: <span className="font-semibold text-white">{ovr.date}</span>
                                  </p>
                                </div>
                              </div>
                              
                              <div className="mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-4 border-t border-white/5 pt-2.5 md:pt-0 md:border-0 font-medium">
                                <div className="text-left md:text-right">
                                  <p className="text-[9px] text-slate-500 font-bold uppercase leading-none">Created</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-1 leading-none">
                                    {formattedDate}, {formattedTime}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                  </div>
                                  
                                  <button
                                    onClick={() => handleRevokeOverride(ovr.key)}
                                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded transition-all"
                                    title="Revoke Override"
                                  >
                                    <FiXCircle size={14} />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Description / Notes */}
              <div className="space-y-6">
                <div className="bg-black border border-white/5 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-black text-white mb-2">Understanding Overrides</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Automatic APIs often miss municipal curfews, blockades, or local transport bandhs. Placing an override:
                  </p>
                  
                  <ul className="space-y-3 text-[11px] text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 select-none">•</span>
                      <span>Forces claim validations to check this override as a **confirmed disruption** for the entire 24-hour period.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 select-none">•</span>
                      <span>Authorizes instant payouts to all drivers registered in the city-pincode block during that day.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 select-none">•</span>
                      <span>Stores the override event in the Redis database cache for 7 days.</span>
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: NEWS ALERTS INBOX */}
          {activeTab === 'news' && (
            <div className="space-y-6">
              
              {/* Date Select Toolbar */}
              <div className="flex items-center justify-between gap-4 bg-black border border-white/5 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <FiGlobe className="size-5 text-primary-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">NewsAPI Automated Scan Feed</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">Filter Date:</span>
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="bg-black border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500 font-mono"
                  />
                </div>
              </div>

              {/* News Alerts Grid */}
              {newsLoading ? (
                <div className="bg-black border border-white/5 rounded-2xl py-20 flex flex-col items-center justify-center gap-3">
                  <FiRefreshCw className="size-6 text-slate-600 animate-spin" />
                  <p className="text-xs text-slate-500 font-bold">Scanning automated News feed for active zones...</p>
                </div>
              ) : newsAlerts.length === 0 ? (
                <div className="bg-black border border-white/5 rounded-2xl py-20 text-center shadow-sm">
                  <FiCompass className="size-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">No active strike or curfew news articles found for Guntur, Vijayawada, or Visakhapatnam.</p>
                  <p className="text-xs text-slate-600 mt-1">If using a mock NewsAPI key, alerts will show when strikes are simulated.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {newsAlerts.map((alert, idx) => (
                    <div key={idx} className="bg-black border border-white/5 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/10 transition-colors">
                      <div className="absolute top-0 right-0 bg-red-500/10 border-b border-l border-red-500/25 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-red-400 rounded-bl-lg">
                        {alert.type}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-primary-500/10 border border-primary-500/25 text-primary-400 text-[10px] font-bold px-2 py-0.5 rounded">
                            📍 {alert.city}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">{alert.source}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white leading-snug mb-3 group-hover:text-primary-300 transition-colors">
                          {alert.title}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleQuickOverride(alert)}
                        className="w-full mt-4 py-2 rounded-lg bg-white/5 hover:bg-primary-500 hover:text-black border border-white/10 text-slate-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Confirm Override <FiArrowUpRight className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 5: DRIVER POLICIES */}
          {activeTab === 'drivers' && (
            <div className="space-y-6">
              
              {/* Search Toolbar */}
              <div className="flex items-center justify-between gap-4 bg-black border border-white/5 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                  <FiUsers className="size-5 text-primary-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Driver Policy Manager</span>
                </div>

                <div className="relative w-full md:w-72">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                  <input
                    type="text"
                    placeholder="Search by driver ID or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-white/5 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>

              {/* Drivers Table list */}
              <div className="bg-black border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                {driversLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <FiRefreshCw className="size-6 text-slate-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-bold">Querying driver registry...</p>
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div className="py-20 text-center">
                    <p className="text-sm font-bold text-slate-500">No active drivers found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.01]">
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Driver ID</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Email</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Selected Plan</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Weekly Premium</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Policy Status</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Created At</th>
                          <th className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest font-extrabold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredDrivers.map(drv => {
                          const isActive = drv.status === 'SUCCESS';
                          const isPaused = drv.status === 'PAUSED';

                          return (
                            <tr key={drv._id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-mono text-xs font-bold text-white">
                                {drv.userId}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-400">
                                {drv.email || 'driver@rideshield.com'}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-white capitalize">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  drv.plan === 'pro' || drv.plan === 'premium'
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                    : 'bg-slate-500/10 border border-slate-500/20 text-slate-300'
                                }`}>
                                  {drv.plan}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-white font-mono text-xs">
                                ₹{drv.amount.toFixed(2)}/wk
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className={`size-1.5 rounded-full ${
                                    isActive ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-red-500'
                                  }`} />
                                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                                    isActive ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-red-400'
                                  }`}>
                                    {isActive ? 'Active' : isPaused ? 'Paused (Inactive)' : drv.status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-400 font-mono">
                                {new Date(drv.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  disabled={actionLoadingId === drv.userId}
                                  onClick={() => handleTogglePolicyStatus(drv.userId, drv.status)}
                                  className={`px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50 ${
                                    isActive
                                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                                      : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                                  }`}
                                >
                                  {isActive ? 'Pause Policy' : 'Resume Policy'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="mt-auto pt-10 text-center border-t border-white/5 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
          RideShield Operations · Parametric Underwriter Panel
        </footer>
      </main>

    </div>
  );
}
