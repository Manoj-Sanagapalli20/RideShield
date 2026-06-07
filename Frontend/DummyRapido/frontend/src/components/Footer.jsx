import React from 'react';
import { 
  FaFacebook, 
  FaTwitter, 
  FaInstagram, 
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaArrowRight
} from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-gray-950 text-white pt-24 pb-12 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 bride-b border-gray-800 pb-16 mb-12">
        <div className="md:col-span-1">
          <span className="text-4xl font-black italic tracking-tighter text-white cursor-default select-none transition hover:text-yellow-500 duration-500">rapido</span>
          <p className="mt-8 text-gray-400 text-lg leading-relaxed font-medium">
            Join the movement. Deliver more than food — deliver happiness to every doorstep in India.
          </p>
        </div>
        
        <div className="md:pl-10">
          <h4 className="font-bold uppercase tracking-widest text-xs mb-8 text-gray-500">Explore</h4>
          <ul className="flex flex-col gap-5">
            <li><a href="#" className="text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block">Partner App</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block">Support Center</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block">Insurance Policy</a></li>
            <li><a href="#" className="text-gray-400 hover:text-white transition-all hover:translate-x-1 inline-block">Earning Chart</a></li>
          </ul>
        </div>

        <div className="md:pl-5">
          <h4 className="font-bold uppercase tracking-widest text-xs mb-8 text-gray-500">Get in Touch</h4>
          <ul className="flex flex-col gap-6">
            <li className="flex items-center gap-4 text-gray-400 font-medium">
              <div className="size-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 shrink-0">
                <FaPhoneAlt className="text-yellow-500"/>
              </div>
              <span className="text-base">1800-456-7890</span>
            </li>
            <li className="flex items-center gap-4 text-gray-400 font-medium">
              <div className="size-10 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-800 shrink-0">
                <FaMapMarkerAlt className="text-yellow-500"/>
              </div>
              <span className="text-base">DLF Phase 4, Gurgaon, <br/>India 122001</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold uppercase tracking-widest text-xs mb-8 text-gray-500">Newsletter</h4>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">Get the latest payout updates and safety tips every Monday.</p>
          <div className="flex bg-gray-900 p-2 rounded-2xl border border-gray-800 focus-within:bride-yellow-500 transition-all shadow-inner">
            <input 
              type="text" 
              placeholder="Your email" 
              className="bg-transparent bride-none outline-none py-2 px-4 text-white w-full text-sm"
            />
            <button className="bg-yellow-500 p-3 rounded-xl hover:bg-yellow-500 transition shadow-lg shadow-yellow-500/10">
              <FaArrowRight className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-500 text-[13px] gap-8 font-medium">
        <div className="flex gap-8">
          <p>&copy; {new Date().getFullYear()} Rapido Delivery Center Inc.</p>
          <div className="hidden md:flex gap-6 bride-l border-gray-800 pl-6">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Security</a>
          </div>
        </div>
        
        <div className="flex gap-4">
          <a href="#" className="size-12 bg-gray-900 flex items-center justify-center rounded-2xl border border-gray-800 hover:bride-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-500 transition-all text-xl"><FaFacebook /></a>
          <a href="#" className="size-12 bg-gray-900 flex items-center justify-center rounded-2xl border border-gray-800 hover:bride-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-500 transition-all text-xl"><FaTwitter /></a>
          <a href="#" className="size-12 bg-gray-900 flex items-center justify-center rounded-2xl border border-gray-800 hover:bride-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-500 transition-all text-xl"><FaInstagram /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
