import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPhoneAlt, FaLock } from 'react-icons/fa';
import toast from 'react-hot-toast';

const LoginPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const phone = e.target.elements[0].value;
        const password = e.target.elements[1].value;

        try {
            const response = await fetch('http://localhost:5000/api/partners/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const result = await response.json();

            if (response.ok) {
                // Store user data in localStorage
                localStorage.setItem('rapidoPartner', JSON.stringify(result.partner));
                toast.success(`Welcome back, Captain ${result.partner.name}!`, {
                    icon: '🛵',
                });
                navigate('/dashboard');
            } else {
                toast.error(result.message || "Login failed");
            }
        } catch (error) {
            toast.error("Connection error! Make sure backend is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-gray-50 to-gray-200 flex items-center justify-center px-4 py-12 relative overflow-hidden">
            {/* Background elements for dynamic feel */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
            
            <div className="max-w-md w-full bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-yellow-500/5 overflow-hidden border border-white/50 relative z-10">
                <div className="p-8 md:p-12">
                    <div className="text-center mb-10">
                        <Link to="/" className="text-4xl font-black italic text-yellow-500 tracking-tighter">rapido</Link>
                        <h2 className="mt-6 text-2xl font-black text-gray-900">Partner Login</h2>
                        <p className="mt-2 text-gray-500 font-medium">Earn more with India's best fleet</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Mobile Number</label>
                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 focus-within:bride-yellow-500 transition-all">
                                <FaPhoneAlt className="text-gray-400 mr-3 shrink-0" />
                                <input 
                                    type="tel" 
                                    placeholder="Enter your registered mobile" 
                                    className="bg-transparent border-none outline-none w-full text-gray-700 font-medium" 
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Password</label>
                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 focus-within:bride-yellow-500 transition-all">
                                <FaLock className="text-gray-400 mr-3 shrink-0" />
                                <input 
                                    type="password" 
                                    placeholder="••••••••" 
                                    className="bg-transparent border-none outline-none w-full text-gray-700 font-medium" 
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <a href="#" className="underline text-sm font-bold text-yellow-500 hover:text-yellow-500">Forgot Password?</a>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className={`w-full bg-yellow-400 text-gray-900 py-4 rounded-2xl font-black text-lg hover:bg-yellow-300 hover:shadow-yellow-400/40 transition-all duration-300 shadow-xl shadow-yellow-400/20 active:scale-95 flex items-center justify-center ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-gray-500 font-medium">New to Rapido Delivery?</p>
                        <Link 
                            to="/register" 
                            className="mt-2 inline-block text-yellow-500 font-black hover:scale-105 transition-transform"
                        >
                            Register as a Partner
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
