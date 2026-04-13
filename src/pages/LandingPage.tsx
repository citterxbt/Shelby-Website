import { Link } from "react-router-dom";
import { Button } from "@/src/components/ui/button";
import { motion } from "motion/react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 px-6 py-6 flex justify-between items-center">
        <div className="text-xl font-bold tracking-widest">CIRCLE STORAGE</div>
        <div className="hidden md:flex gap-6 text-xs font-medium tracking-widest text-gray-400">
          <a href="#features" className="hover:text-white transition-colors">FEATURES</a>
          <a href="#stats" className="hover:text-white transition-colors">STATS</a>
          <a href="#about" className="hover:text-white transition-colors">ABOUT</a>
          <a href="#quotes" className="hover:text-white transition-colors">TESTIMONIALS</a>
        </div>
        <Link to="/app">
          <Button className="bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold tracking-widest rounded-none px-6 py-2 h-auto">
            LAUNCH APP
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen min-h-[800px] flex flex-col justify-center px-6 md:px-16 pt-20">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2832&auto=format&fit=crop" 
            alt="Abstract tech background" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]" />
        </div>
        
        <div className="relative z-10 max-w-5xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl lg:text-[140px] font-light leading-none tracking-tight mb-6"
          >
            DECENTRALIZED<br />
            <span className="font-serif italic text-orange-500">STORAGE</span>
          </motion.h1>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mt-12">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-gray-300 max-w-md text-sm md:text-base leading-relaxed"
            >
              Secure, verifiable, and permanent data storage leveraging the Shelby protocol and Aptos network infrastructure.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="px-6 md:px-16 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "SHELBY PROTOCOL", desc: "Data is erasure-coded and distributed across the Shelby testnet, ensuring cryptographic immutability and high availability." },
            { title: "APTOS INTEGRATION", desc: "Seamless passwordless authentication and transaction signing directly through your Aptos wallet (Petra)." },
            { title: "RETENTION CONTROL", desc: "Flexible storage duration options. Choose between 30-day temporary retention or permanent on-chain storage." },
            { title: "STRICT PRIVACY", desc: "User files are strictly confidential. Our architecture ensures that only the authenticated uploader can access their data." }
          ].map((feature, i) => (
            <div key={i} className="bg-[#141414] p-8 rounded-sm hover:bg-[#1a1a1a] transition-colors group">
              <h3 className="text-sm font-medium tracking-widest mb-4 text-orange-500">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="px-6 md:px-16 py-24 border-y border-white/5 my-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
          {[
            { label: "NODES", value: "150+" },
            { label: "CLIENTS", value: "500+" },
            { label: "TERABYTES", value: "20K+" },
            { label: "DAPPS", value: "50+" }
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-xs tracking-widest text-gray-500 mb-2">{stat.label}</div>
              <div className="text-4xl md:text-5xl font-light">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About Split */}
      <section id="about" className="px-6 md:px-16 py-12">
        <div className="text-xs tracking-widest text-gray-500 mb-12">ABOUT</div>
        <div className="grid md:grid-cols-2 gap-12 lg:gap-24">
          <div>
            <h2 className="text-4xl md:text-5xl font-light leading-tight mb-12">
              WHERE WEB3 MEETS<br />STORAGE
            </h2>
            <div className="grid sm:grid-cols-2 gap-8 text-sm text-gray-400 leading-relaxed">
              <p>
                We believe that data storage should be an expression of digital sovereignty. We encourage security and originality in every byte we store, presenting users with exclusive infrastructure from independent nodes.
              </p>
              <p>
                With a commitment to fostering a community of creativity and innovation, we strive to connect developers with infrastructure enthusiasts who appreciate the architecture and individuality behind each protocol.
              </p>
            </div>
          </div>
          <div className="h-[600px]">
            <img 
              src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop" 
              alt="Server racks" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Quotes / Advantages */}
      <section id="quotes" className="px-6 md:px-16 py-24">
        <h2 className="text-3xl font-light mb-12">ECOSYSTEM VOICES</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 h-[400px] md:h-auto">
             <img 
              src="https://images.unsplash.com/photo-1618060932014-4deda4932554?q=80&w=2000&auto=format&fit=crop" 
              alt="Abstract" 
              className="w-full h-full object-cover grayscale opacity-80"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="lg:col-span-2 grid grid-rows-2 gap-4">
            <div className="bg-[#141414] p-8 md:p-12 flex flex-col justify-center">
              <h3 className="text-sm font-medium tracking-widest mb-4 text-orange-500">APTOS DEVELOPERS</h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                "Circle Storage provides the missing piece for fully decentralized applications on Aptos. The integration with the Shelby protocol ensures our users' data is as secure as their on-chain assets."
              </p>
            </div>
            <div className="bg-[#141414] p-8 md:p-12 flex flex-col justify-center">
              <h3 className="text-sm font-medium tracking-widest mb-4 text-orange-500">WEB3 INVESTORS</h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                "The architecture behind Circle Storage represents a paradigm shift. By leveraging Aptos's high throughput and Shelby's erasure coding, it delivers enterprise-grade reliability."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-16 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-xs tracking-widest text-gray-500">
        <div>© 2026 CIRCLE STORAGE.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition-colors">TWITTER</a>
          <a href="#" className="hover:text-white transition-colors">DISCORD</a>
          <a href="#" className="hover:text-white transition-colors">GITHUB</a>
        </div>
      </footer>
    </div>
  );
}
