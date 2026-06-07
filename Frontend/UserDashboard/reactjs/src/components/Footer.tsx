import { footerData } from "../data/footer";
import { DribbbleIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from "lucide-react";
import { motion } from "motion/react";
import type { IFooterLink } from "../types";
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="flex flex-wrap justify-center md:justify-between overflow-hidden gap-10 md:gap-20 mt-20 md:mt-40 py-12 px-6 md:px-16 lg:px-24 xl:px-32 text-[13px] text-gray-500 bride-t bride-white/5 bg-black/20">
            <motion.div className="flex flex-wrap items-start justify-center md:justify-start gap-10 md:gap-32"
                initial={{ x: -150, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
            >
                <Link to="/" className="flex flex-col gap-4 items-center md:items-start shrink-0">
                    <img className="size-8 aspect-square" src="/assets/footer-logo.svg" alt="footer logo" width={32} height={32} />
                    <p className="max-w-xs text-center md:text-left text-slate-400 leading-relaxed">
                        The first parametric insurance for captains in India.
                    </p>
                </Link>
                <div className="flex flex-wrap gap-10 md:gap-24 justify-center md:justify-start">
                    {footerData.map((section, index) => (
                        <div key={index} className="min-w-[120px]">
                            <p className="text-slate-100 font-bold uppercase tracking-widest text-[11px] mb-4">{section.title}</p>
                            <ul className="space-y-3">
                                {section.links.map((link: IFooterLink, index: number) => (
                                    <li key={index}>
                                        <Link to={link.href} className="hover:text-primary-500 transition-colors font-medium">
                                            {link.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div className="flex flex-col max-md:items-center max-md:text-center gap-6 items-end w-full lg:w-auto mt-12 lg:mt-0"
                initial={{ x: 150, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 280, damping: 70, mass: 1 }}
            >
                <div className="flex items-center gap-4">
                    <a href="#" target="_blank" rel="noreferrer" className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-500/10 hover:text-primary-500 transition-all bride bride-white/5">
                        <TwitterIcon className="size-4" />
                    </a>
                    <a href="#" target="_blank" rel="noreferrer" className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-500/10 hover:text-primary-500 transition-all bride bride-white/5">
                        <LinkedinIcon className="size-4" />
                    </a>
                    <a href="#" target="_blank" rel="noreferrer" className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-500/10 hover:text-primary-500 transition-all bride bride-white/5">
                        <DribbbleIcon className="size-4" />
                    </a>
                    <a href="#" target="_blank" rel="noreferrer" className="size-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-500/10 hover:text-primary-500 transition-all bride bride-white/5">
                        <YoutubeIcon className="size-5" />
                    </a>
                </div>
                <p className="text-slate-400 font-medium">
                    &copy; {new Date().getFullYear()} RideShield. All rights reserved.
                </p>
            </motion.div>
        </footer>
    );
}
