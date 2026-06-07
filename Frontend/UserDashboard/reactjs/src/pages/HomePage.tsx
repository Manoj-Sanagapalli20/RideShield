import Navbar from "../components/Navbar";
import HeroSection from "../sections/HeroSection";
import HowItWorksSection from "../sections/HowItWorksSection";
import FeaturesSection from "../sections/FeaturesSection";
import TestimonialSection from "../sections/TestimonialSection";
import PricingSection from "../sections/PricingSection";
import FAQSection from "../sections/FAQSection";
import ContactSection from "../sections/ContactSection";
import CTASection from "../sections/CTASection";
import Footer from "../components/Footer";
import LenisScroll from "../components/LenisScroll";

export default function HomePage() {
    return (
        <div className="font-poppins">
            <LenisScroll />
            <Navbar />
            <HeroSection />
            <HowItWorksSection />
            <FeaturesSection />
            <TestimonialSection />
            <PricingSection />
            <FAQSection />
            <ContactSection />
            <CTASection />
            <Footer />
        </div>
    );
}
