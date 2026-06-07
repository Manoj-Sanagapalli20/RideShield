import React, { useState, useEffect } from 'react';
import { generateHourlyData } from '../utils/dummyData';
import { FaMotorcycle, FaWallet, FaCheckCircle, FaExclamationCircle, FaUserCircle, FaSignOutAlt, FaPlus, FaMinus } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const DashboardPage = () => {
    const [hourlyData, setHourlyData] = useState([]);
    const [partner, setPartner] = useState(null);
    const [selectedDate, setSelectedDate] = useState('2026-03-18');
    const [stats, setStats] = useState({ totalRides: 0, totalEarnings: 0, currentStatus: 'Online' });
    const navigate = useNavigate();

    // Initial data load
    useEffect(() => {
        // Load partner from storage
        const storedPartner = localStorage.getItem('rapidoPartner');
        if (!storedPartner) {
            navigate('/login');
            return;
        }
        const partnerData = JSON.parse(storedPartner);
        setPartner(partnerData);

        const data = generateHourlyData();
        setHourlyData(data);
        calculateStats(data);
    }, []);

    // Recalculate stats whenever data changes
    const calculateStats = (data) => {
        const rides = data.reduce((acc, curr) => acc + curr.ridesAccepted, 0);
        const earnings = data.reduce((acc, curr) => acc + curr.earnings, 0);
        const latestOnline = data.length > 0 ? data[data.length - 1].isOnline : false;
        
        setStats({
            totalRides: rides,
            totalEarnings: earnings,
            currentStatus: latestOnline ? 'Online' : 'Offline'
        });
    };

    const toggleStatus = (index) => {
        const newData = [...hourlyData];
        newData[index].isOnline = !newData[index].isOnline;
        
        // If going offline, usually rides stop
        if (!newData[index].isOnline) {
            newData[index].ridesAccepted = 0;
            newData[index].earnings = 0;
        }
        
        setHourlyData(newData);
        calculateStats(newData);
    };

    const updateRides = (index, delta) => {
        const newData = [...hourlyData];
        // Can only add rides if online
        if (!newData[index].isOnline && delta > 0) {
            toast.error("Partner must be Online to accept rides!", {
                icon: '⚠️',
            });
            return;
        }

        const newCount = Math.max(0, newData[index].ridesAccepted + delta);
        newData[index].ridesAccepted = newCount;
        newData[index].earnings = newCount * 45; // Recalculate based on fixed rate
        
        setHourlyData(newData);
        calculateStats(newData);
    };

    const handleLogout = () => {
        localStorage.removeItem('rapidoPartner');
        toast.success("Successfully Logged Out");
        navigate('/');
    };

    const handleSaveData = async () => {
        const dataToSave = {
            partnerId: partner?._id,
            date: selectedDate, // YYYY-MM-DD to match ML Service
            totalRides: stats.totalRides,
            totalEarnings: stats.totalEarnings,
            hourlyActivity: hourlyData
        };
        
        try {
            const response = await fetch('http://localhost:5000/api/partners/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });

            if (response.ok) {
                toast.success("Activity synced to database!", {
                    icon: '✅',
                });
            } else {
                toast.error("Failed to save activity.");
            }
        } catch (error) {
            toast.error("Connection error! Make sure backend is running.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Dashboard Header */}
            <header className="bg-white bride-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black italic text-yellow-500 tracking-tighter">rapido</span>
                    <div className="hidden sm:flex flex-col bride-l border-gray-200 pl-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1">Partner Portal</span>
                        <span className="text-xs font-bold text-gray-900 leading-none">ID: {partner?.partnerId || '00000'}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <button 
                        onClick={handleSaveData}
                        className="hidden md:flex items-center gap-2 bg-yellow-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-200 active:scale-95"
                    >
                        Sync Activity
                    </button>
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-black text-gray-900">{partner?.name || 'Partner'}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${stats.currentStatus === 'Online' ? 'text-green-500' : 'text-gray-400'}`}>
                           ● {stats.currentStatus}
                        </span>
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-3 rounded-full bg-gray-50 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 transition-all border border-gray-200 shadow-sm"
                    >
                        <FaSignOutAlt />
                    </button>
                </div>
            </header>

            <main className="max-w-7xl w-full mx-auto px-6 py-10 flex-grow">
                {/* Stats Summary Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 flex items-center gap-5">
                        <div className="size-16 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-500 text-3xl shrink-0 border bride-yellow-100 transition hover:rotate-6">
                            <FaMotorcycle />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Deliveries Today</p>
                            <h2 className="text-3xl font-black text-gray-900">{stats.totalRides}</h2>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 flex items-center gap-5">
                        <div className="size-16 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 text-3xl shrink-0 border bride-green-100 transition hover:rotate-6">
                            <FaWallet />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Estimated Earnings Today</p>
                            <h2 className="text-3xl font-black text-gray-900">₹{stats.totalEarnings.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 flex items-center gap-5">
                        <div className={`size-16 rounded-2xl ${stats.currentStatus === 'Online' ? 'bg-blue-50 text-blue-500 bride-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100'} flex items-center justify-center text-3xl shrink-0 border transition hover:rotate-6`}>
                            <FaCheckCircle />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current App Status</p>
                            <h2 className={`text-3xl font-black ${stats.currentStatus === 'Online' ? 'text-gray-900' : 'text-gray-400'}`}>
                                {stats.currentStatus}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Hourly Log Section */}
                <div className="bg-white rounded-[32px] shadow-2xl shadow-gray-200 border border-gray-100 overflow-hidden mb-12">
                    <div className="px-8 py-6 bride-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-gray-50/50">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Activity Customizer</h3>
                            <label className="text-[10px] uppercase font-black tracking-widest text-gray-400">Simulation Date:</label>
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="ml-2 bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold text-gray-700 outline-none focus:bride-yellow-500"
                            />
                        </div>
                        <p className="text-[11px] font-bold text-yellow-500 bg-yellow-50 px-4 py-2 rounded-full border bride-yellow-100">Click Status or Use +/- to Modify Data</p>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white text-[11px] font-black tracking-[0.1em] text-gray-400 uppercase">
                                <tr>
                                    <th className="px-8 py-5 bride-b border-gray-100">Time Slot</th>
                                    <th className="px-8 py-5 bride-b border-gray-100">Toggle Status</th>
                                    <th className="px-8 py-5 bride-b border-gray-100 text-center">Adjust Rides</th>
                                    <th className="px-8 py-5 bride-b border-gray-100">Hourly Income</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {hourlyData.map((row, index) => (
                                    <tr key={index} className="hover:bg-yellow-50/20 transition-colors group">
                                        <td className="px-8 py-5 font-bold text-gray-700">{row.timeSlot}</td>
                                        <td className="px-8 py-5">
                                            <button 
                                                onClick={() => toggleStatus(index)}
                                                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all active:scale-95 ${row.isOnline ? 'bg-green-50 text-green-600 bride-green-100 hover:bg-green-100' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'}`}
                                            >
                                                {row.isOnline ? 'Online' : 'Offline'}
                                            </button>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-center gap-4">
                                                <button 
                                                    onClick={() => updateRides(index, -1)}
                                                    className="size-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-yellow-500 hover:text-white transition-all border border-gray-200 active:scale-90"
                                                >
                                                    <FaMinus size={10}/>
                                                </button>
                                                
                                                <div className="flex flex-col items-center min-w-[30px]">
                                                    <span className={`text-xl font-black ${row.ridesAccepted > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                                        {row.ridesAccepted}
                                                    </span>
                                                </div>

                                                <button 
                                                    onClick={() => updateRides(index, 1)}
                                                    className="size-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-yellow-500 hover:text-white transition-all border border-gray-200 active:scale-90"
                                                >
                                                    <FaPlus size={10}/>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`text-base font-black ${row.earnings > 0 ? 'text-yellow-500' : 'text-gray-300'}`}>
                                                ₹{row.earnings}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Main Save Action Button (Bottom) */}
                <div className="flex justify-center pb-20">
                    <button 
                        onClick={handleSaveData}
                        className="w-full md:w-max bg-gray-900 text-white px-14 py-3 rounded-3xl font-black text-md hover:bg-black transition-all shadow-2xl shadow-gray-200 active:scale-95 flex items-center justify-center gap-4"
                    >
                        Save Data to Database
                    </button>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;
