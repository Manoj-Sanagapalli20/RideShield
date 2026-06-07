import React, { useState } from 'react';
import { HiMenu, HiX } from 'react-icons/hi';
import { Link } from 'react-router-dom';

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 md:h-20">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer">
                        <span className="text-3xl font-black italic text-yellow-500 tracking-tighter">rapido</span>
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-widest pl-2 border-l border-gray-200 hidden sm:block font-[Poppins]">Captain Fleet</span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-10">
                        <a href="#" className="font-semibold text-gray-600 hover:text-yellow-500 transition-colors">How it works</a>
                        <a href="#" className="font-semibold text-gray-600 hover:text-yellow-500 transition-colors">Benefits</a>
                        <a href="#" className="font-semibold text-gray-600 hover:text-yellow-500 transition-colors">Requirements</a>
                        <Link to="/login" className="bg-yellow-400 text-gray-900 px-7 py-3 rounded-xl font-black hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/20 active:scale-95 border border-yellow-300/50">
                            Register Now
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button className="md:hidden text-2xl text-gray-700" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <HiX /> : <HiMenu />}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-b border-gray-100 p-6 flex flex-col gap-5 animate-in slide-in-from-top-4 duration-300">
                    <a href="#" className="font-bold text-gray-700 text-lg py-2 border-b border-gray-50">How it works</a>
                    <a href="#" className="font-bold text-gray-700 text-lg py-2 border-b border-gray-50">Benefits</a>
                    <a href="#" className="font-bold text-gray-700 text-lg py-2 border-b border-gray-50">Requirements</a>
                    <Link to="/login" className="bg-yellow-400 text-gray-900 px-6 py-4 rounded-xl font-black text-lg shadow-lg shadow-yellow-400/20 block text-center border border-yellow-300/50">
                        Register Now
                    </Link>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
