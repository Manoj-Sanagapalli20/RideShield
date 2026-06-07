import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa';

const Hero = () => {
    return (
        <section className="pt-32 pb-20 md:pt-48 md:pb-40 px-4 bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Graphic elements */}
            <div className="absolute top-20 right-[5%] w-[40%] h-[80%] opacity-20 pointer-events-none hidden md:block">
                <div className="w-full h-full bg-gradient-to-br from-yellow-400/40 to-transparent blur-3xl rounded-full"></div>
            </div>

            <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-yellow-50 text-yellow-600 font-black text-sm uppercase tracking-widest mb-10 shadow-sm border border-yellow-200">
                    <span className="size-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    Now Hiring Captains
                </div>
                
                <h1 className="text-4xl md:text-7xl font-black text-gray-900 mb-8 leading-[1.1] tracking-tighter">
                    Drive with Rapido <br/>
                    <span className="text-yellow-500 italic">Earn instantly.</span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                    Join India's leading delivery fleet today. Weekly payouts, complete insurance cover, and total freedom over your work schedule.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
                    <Link to="/register" className="w-full sm:w-auto bg-yellow-400 text-gray-900 px-8 py-3.5 rounded-xl font-black text-lg hover:bg-yellow-300 hover:scale-105 transition-all shadow-xl shadow-yellow-400/20 flex items-center justify-center gap-3 border border-yellow-300/50">
                        Join Current Batch <FaArrowRight className="text-lg" />
                    </Link>
                    <div className="text-left py-2 px-1">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Partners Trust Us</p>
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                        <div key={i} className="size-10 rounded-full bg-gray-200 border-2 border-white shadow-md ring-1 ring-gray-100 overflow-hidden">
                                            <div className="w-full h-full bg-gradient-to-br from-yellow-100 to-yellow-300"></div>
                                        </div>
                                ))}
                            </div>
                            <span className="text-lg font-bold text-gray-700">3 Lakh+ Strong Fleet</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
