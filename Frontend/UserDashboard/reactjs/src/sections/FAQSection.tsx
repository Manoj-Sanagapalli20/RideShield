import SectionTitle from "../components/SectionTitle";
import { ChevronDown } from "lucide-react";

export default function FAQSection() {
    const faqs = [
        {
            q: "Do I need to file a claim when there is heavy rain or a bandh?",
            a: "No! RideShield uses zero-touch parametric insurance. We automatically monitor weather APIs and news sources. When a disruption hits your working zone and halts Rapido deliveries, we verify it and issue the payout automatically. No forms, no calls, no agents."
        },
        {
            q: "How quickly do I get my payout?",
            a: "By 6 AM the very next day. We process the previous day's disruption data every night. By the time you wake up, your payout is already deposited directly into your linked UPI account."
        },
        {
            q: "Is the weekly payout a fixed flat amount?",
            a: "No, payouts are completely proportional and fair. Your payout is calculated exactly based on how many hours your work was disrupted during the day. If rain stopped you for 4 hours, you are compensated for those specific 4 hours up to your plan's maximum weekly limit."
        },
        {
            q: "What happens if I decide to take a week off from Rapido?",
            a: "Your RideShield coverage automatically pauses when you're inactive. Our system syncs with your Rapido ID — if you aren't working, you aren't charged, and your coverage simply waits until you start delivering again."
        },
        {
            q: "Can I cancel my plan anytime?",
            a: "Absolutely. We charge on a weekly basis, directly matching how Rapido pays you. There are no sneaky term limits, annual contracts, or hidden exit fees. You can upgrade, downgrade, or cancel your weekly plan instantly from your dashboard."
        }
    ];

    return (
        <div id="faqs" className="px-4 md:px-16 lg:px-24 xl:px-32 py-24">
            <SectionTitle 
                text1="FAQs" 
                text2="Got questions? We've got answers." 
                text3="Everything you need to know about how RideShield protects your income." 
            />

            <div className="mt-20 max-w-4xl mx-auto space-y-2">
                {faqs.map((faq, index) => (
                    <details 
                        key={index} 
                        className="group bride bride-white/5 bg-white/[0.02] p-6 rounded-2xl [&_summary::-webkit-details-marker]:hidden hover:bg-white/[0.04] transition-colors"
                        open={index === 0} // open the first one by default
                    >
                        <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-medium text-white transition-colors duration-300 group-open:-mb-4 group-open:pb-4 group-open:bride-b group-open:bride-white/10">
                            <h2 className="group-open:text-primary-400 group-hover:text-primary-300 transition-colors pr-6">{faq.q}</h2>
                            <span className="relative size-6 shrink-0 bg-white/5 rounded-full flex items-center justify-center bride bride-white/10 group-open:bg-primary-500/10 group-open:bride-primary-500/20 transition-all">
                                <ChevronDown className="size-4 transition duration-300 group-open:-rotate-180 text-primary-500" />
                            </span>
                        </summary>
                        <p className="mt-8 leading-relaxed text-slate-400 pl-2 bride-l-2 bride-primary-500/50">
                            {faq.a}
                        </p>
                    </details>
                ))}
            </div>
        </div>
    );
}
