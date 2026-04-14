import { Link } from "react-router-dom";
import { Button } from "@/src/components/ui/button";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export default function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white font-sans selection:bg-white/30 overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-8 flex justify-between items-center mix-blend-difference">
        <div className="text-sm font-bold tracking-[0.2em] font-sans">CIRCLE STORAGE</div>
        <Link to="/app">
          <Button className="bg-white hover:bg-gray-200 text-black text-xs font-bold tracking-[0.2em] rounded-full px-8 py-3 transition-all duration-300">
            LAUNCH APP
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col justify-center items-center px-6">
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40">
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.05, 1],
            }}
            transition={{ 
              rotate: { duration: 40, repeat: Infinity, ease: "linear" },
              scale: { duration: 8, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-[600px] h-[600px] rounded-full border border-white/10"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)',
              boxShadow: 'inset 0 0 100px rgba(255,255,255,0.05), 0 0 150px rgba(255,255,255,0.02)'
            }}
          />
        </div>
        
        <div className="relative z-10 text-center max-w-5xl flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-6xl md:text-8xl lg:text-[160px] font-light leading-[0.85] tracking-tighter mb-8 font-sans">
              <span className="block text-white">CIRCLE</span>
              <span className="block text-metallic italic font-serif pr-4">STORAGE</span>
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1.2 }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 mt-8"
          >
            <p className="text-gray-400 text-xs md:text-sm tracking-[0.1em] font-medium uppercase text-center">
              Unlimited Storage
            </p>
            <div className="w-1 h-1 bg-white/20 rounded-full hidden md:block" />
            <p className="text-gray-400 text-xs md:text-sm tracking-[0.1em] font-medium uppercase text-center">
              Secure & Sell Without Intermediaries
            </p>
          </motion.div>
        </div>

        <motion.div 
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-xs tracking-[0.2em] text-gray-500 uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
        >
          <span>Scroll to Discover</span>
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-[1px] h-12 bg-gradient-to-b from-gray-500 to-transparent"
          />
        </motion.div>
      </section>

      {/* Storytelling Use Cases */}
      
      {/* Use Case 1: Store & Duration */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-xs tracking-[0.2em] text-gray-500 mb-8 font-bold">01 — FLEXIBLE RETENTION</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Store <span className="text-metallic italic font-serif">Any File</span><br />
              On Your Terms
            </h2>
            <p className="text-gray-400 leading-relaxed text-lg font-light">
              Choose the lifecycle of your digital assets. Preserve them permanently on-chain, or specify a predefined duration for temporary retention. Circle Storage adapts to your precise data demands without compromises.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0a0a0a] border border-white/5 p-12 aspect-square flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
          >
            <div className="w-48 h-48 rounded-full border border-white/20 flex items-center justify-center relative">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-full opacity-50 blur-xl" />
               <h3 className="text-6xl font-light text-white tracking-tighter">∞</h3 >
            </div>
            <div className="mt-12 text-sm tracking-[0.2em] text-gray-500 text-center uppercase">
              Permanent On-Chain Archiving
            </div>
          </motion.div>
        </div>
      </section>

      {/* Use Case 2: Sell Content directly */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="order-2 md:order-1 bg-[#0a0a0a] border border-white/5 p-12 aspect-square flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
          >
           <div className="w-full max-w-[280px] space-y-6">
              <div className="h-16 w-full border border-white/10 rounded-full flex items-center justify-between px-8 bg-white/[0.02]">
                <span className="text-xs tracking-widest text-gray-500">ASSET VALUE</span>
                <span className="text-lg font-light text-metallic">0.5 APT</span>
              </div>
              <div className="h-16 w-full border border-white/20 rounded-full flex items-center justify-center bg-white text-black hover:bg-gray-200 transition-colors cursor-crosshair">
                <span className="text-xs font-bold tracking-[0.2em] whitespace-nowrap">DIRECT PURCHASE</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 md:order-2"
          >
            <div className="text-xs tracking-[0.2em] text-gray-500 mb-8 font-bold">02 — DIRECT ECONOMY</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Commercialize<br />
              <span className="text-metallic italic font-serif">Without Limits</span>
            </h2>
            <p className="text-gray-400 leading-relaxed text-lg font-light">
              Transform your files into sovereign assets. Sell access to your content directly to your audience without intermediaries extracting value. You control the pricing and retain total ownership.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Use Case 3: Privacy First Architecture */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-xs tracking-[0.2em] text-gray-500 mb-8 font-bold">03 — ABSOLUTE PROVENANCE</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Privacy-First <br/>
              <span className="text-metallic italic font-serif">Architecture</span>
            </h2>
            <p className="text-gray-400 leading-relaxed text-lg font-light">
              Your data is encrypted and dispersed across a decentralized network. Although stored on-chain, files remain strictly inaccessible to third parties unless a specific access purchase is made or you choose to share them.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0a0a0a] border border-white/5 p-12 flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
            style={{
              aspectRatio: '1'
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {[...Array(3)].map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0.1, 0] }}
                  transition={{ duration: 4, delay: i * 1.3, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-white/30"
                />
              ))}
              <div className="w-16 h-16 bg-white rounded-full z-10 shadow-[0_0_50px_rgba(255,255,255,0.5)]" />
            </div>
            <div className="absolute bottom-12 text-sm tracking-[0.2em] text-gray-500 text-center uppercase z-20">
              Impenetrable Storage Layer
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-48 px-6 flex flex-col items-center justify-center text-center border-t border-white/5 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1 }}
          className="max-w-3xl flex flex-col items-center"
        >
          <h2 className="text-5xl md:text-7xl font-light mb-12 tracking-tight">
            Ready to <span className="italic font-serif text-metallic">ascend?</span>
          </h2>
          <Link to="/app">
            <Button className="bg-white hover:bg-gray-200 text-black text-sm font-bold tracking-[0.2em] rounded-full px-12 py-8 transition-transform hover:scale-105 duration-300">
              ENTER THE APPLICATION
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-white/10 flex flex-col items-center justify-center gap-6 text-xs tracking-[0.2em] text-gray-600 uppercase relative z-10 bg-black">
        <div>© {new Date().getFullYear()} CIRCLE STORAGE.</div>
      </footer>
    </div>
  );
}
