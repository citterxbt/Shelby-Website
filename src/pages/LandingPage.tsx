import { Link } from "react-router-dom";
import { Button } from "@/src/components/ui/button";
import { motion, useScroll } from "motion/react";
import { useRef } from "react";

export default function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white font-sans selection:bg-white/30 overflow-hidden relative">
      
      {/* 
        Dynamic Silver Liquid Metal / Iridescent Graphic 
        Spans globally behind the content with subtle motion 
      */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none mix-blend-screen opacity-50">
        {/* Silver Core Blob */}
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-[40%] bg-gradient-to-tr from-white via-gray-400 to-gray-800"
          style={{ filter: "blur(80px)" }}
          animate={{
            x: ["-10%", "15%", "-5%", "-10%"],
            y: ["0%", "-20%", "10%", "0%"],
            rotate: [0, 90, 180, 360],
            scale: [1, 1.2, 0.9, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        {/* Iridescent Blue/Cyan Reflection */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-[45%] bg-gradient-to-tr from-[#d0ecf4] to-transparent"
          style={{ filter: "blur(90px)", right: "10%", top: "20%" }}
          animate={{
            x: ["0%", "-30%", "20%", "0%"],
            y: ["10%", "30%", "-10%", "10%"],
            rotate: [360, 180, 90, 0],
            scale: [1, 0.8, 1.1, 1]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        {/* Iridescent Pink/Purple Reflection */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-[#e6ddf7] via-gray-300 to-transparent"
          style={{ filter: "blur(100px)", left: "20%", bottom: "10%" }}
          animate={{
            x: ["20%", "-20%", "10%", "20%"],
            y: ["-20%", "10%", "-30%", "-20%"],
            scale: [0.9, 1.1, 1, 0.9]
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 z-10">
        <div className="relative z-10 text-center max-w-5xl flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-6xl md:text-8xl lg:text-[160px] font-light leading-[0.85] tracking-tighter mb-8 font-sans">
              <span className="block text-white mix-blend-overlay">CIRCLE</span>
              <span className="block text-metallic italic font-serif pr-4">STORAGE</span>
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1.2 }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 mt-8"
          >
            <p className="text-gray-300 text-xs md:text-sm tracking-[0.1em] font-medium uppercase text-center backdrop-blur-sm bg-black/20 px-4 py-1 rounded-full border border-white/5">
              Unlimited Storage
            </p>
            <div className="w-1 h-1 bg-white/20 rounded-full hidden md:block" />
            <p className="text-gray-300 text-xs md:text-sm tracking-[0.1em] font-medium uppercase text-center backdrop-blur-sm bg-black/20 px-4 py-1 rounded-full border border-white/5">
              Secure & Sell Without Intermediaries
            </p>
          </motion.div>
        </div>

        <motion.div 
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 text-xs tracking-[0.2em] text-gray-400 uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
        >
          <span>Scroll to Discover</span>
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-[1px] h-12 bg-gradient-to-b from-gray-400 to-transparent"
          />
        </motion.div>
      </section>

      {/* Storytelling Use Cases */}
      
      {/* Use Case 1: Store & Duration */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32 z-10 backdrop-blur-[2px]">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-xs tracking-[0.2em] text-gray-400 mb-8 font-bold">01 — FLEXIBLE RETENTION</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Store <span className="text-metallic italic font-serif">Any File</span><br />
              On Your Terms
            </h2>
            <p className="text-gray-300 leading-relaxed text-lg font-light">
              Choose the lifecycle of your digital assets. Preserve them permanently on-chain, or specify a predefined duration for temporary retention. Circle Storage adapts to your precise data demands without compromises.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 p-12 aspect-square flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
          >
            <div className="w-48 h-48 rounded-full border border-white/20 flex items-center justify-center relative mix-blend-screen">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-full opacity-50 blur-xl" />
               <h3 className="text-6xl font-light text-white tracking-tighter">∞</h3 >
            </div>
            <div className="mt-12 text-sm tracking-[0.2em] text-gray-400 text-center uppercase">
              Permanent On-Chain Archiving
            </div>
          </motion.div>
        </div>
      </section>

      {/* Use Case 2: Sell Content directly */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32 z-10">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="order-2 md:order-1 bg-black/40 backdrop-blur-xl border border-white/10 p-12 aspect-square flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
          >
           <div className="w-full max-w-[280px] space-y-6">
              <div className="h-16 w-full border border-white/20 rounded-full flex items-center justify-between px-8 bg-black/50 backdrop-blur-md">
                <span className="text-xs tracking-widest text-gray-400">ASSET VALUE</span>
                <span className="text-lg font-light text-metallic">0.5 APT</span>
              </div>
              <div className="h-16 w-full border border-white/30 rounded-full flex items-center justify-center bg-white/5 text-white hover:bg-white hover:text-black transition-colors cursor-crosshair">
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
            <div className="text-xs tracking-[0.2em] text-gray-400 mb-8 font-bold">02 — DIRECT ECONOMY</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Commercialize<br />
              <span className="text-metallic italic font-serif">Without Limits</span>
            </h2>
            <p className="text-gray-300 leading-relaxed text-lg font-light">
              Transform your files into sovereign assets. Sell access to your content directly to your audience without intermediaries extracting value. You control the pricing and retain total ownership.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Use Case 3: Privacy First Architecture */}
      <section className="relative min-h-screen flex items-center py-32 px-6 md:px-16 lg:px-32 z-10 backdrop-blur-[2px]">
        <div className="max-w-6xl w-full mx-auto grid md:grid-cols-2 gap-16 md:gap-32 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-xs tracking-[0.2em] text-gray-400 mb-8 font-bold">03 — ABSOLUTE PROVENANCE</div>
            <h2 className="text-4xl md:text-6xl font-light leading-tight mb-8">
              Privacy-First <br/>
              <span className="text-metallic italic font-serif">Architecture</span>
            </h2>
            <p className="text-gray-300 leading-relaxed text-lg font-light">
              Your data is encrypted and dispersed across a decentralized network. Although stored on-chain, files remain strictly inaccessible to third parties unless a specific access purchase is made or you choose to share them.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 p-12 flex flex-col justify-center items-center relative overflow-hidden group spotlight-card rounded-3xl"
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
                  className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-white/40"
                />
              ))}
              <div className="w-16 h-16 bg-white rounded-full z-10 shadow-[0_0_60px_rgba(255,255,255,0.7)]" />
            </div>
            <div className="absolute bottom-12 text-sm tracking-[0.2em] text-gray-400 text-center uppercase z-20">
              Impenetrable Storage Layer
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative min-h-[60vh] flex flex-col justify-center items-center py-32 px-6 z-10 bg-black/60 backdrop-blur-md border-y border-white/5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="max-w-6xl w-full"
        >
          <div className="text-xs tracking-[0.2em] text-center text-gray-500 mb-16 font-bold">ECOSYSTEM FEEDBACK</div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-white/10 rounded-2xl bg-black/40 flex flex-col justify-between">
              <p className="text-gray-300 font-serif italic text-lg leading-relaxed mb-8">
                "The necessity for an architecture that doesn't just promise security, but structurally guarantees it on-chain, is paramount in today's digital climate. This is the next evolution."
              </p>
              <div className="text-xs tracking-[0.1em] text-gray-500 uppercase">— Anonymous</div>
            </div>

            <div className="p-8 border border-white/10 rounded-2xl bg-black/40 flex flex-col justify-between">
              <p className="text-gray-300 font-serif italic text-lg leading-relaxed mb-8">
                "Integrating storage natively onto the network without relying on fragile external IPFS indexing layers entirely changes the velocity of dapp deployment. Truly seamless."
              </p>
              <div className="text-xs tracking-[0.1em] text-gray-500 uppercase">— Aptos Developers</div>
            </div>

            <div className="p-8 border border-white/10 rounded-2xl bg-black/40 flex flex-col justify-between">
              <p className="text-gray-300 font-serif italic text-lg leading-relaxed mb-8">
                "Eliminating intermediaries isn't just about reducing costs—it's about retaining absolute ownership. The ability to sell assets directly has shifted my entire distribution model."
              </p>
              <div className="text-xs tracking-[0.1em] text-gray-500 uppercase">— Early Beta Testers</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="relative py-48 px-6 flex flex-col items-center justify-center text-center z-10 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1 }}
          className="max-w-3xl flex flex-col items-center"
        >
          <h2 className="text-5xl md:text-7xl font-light mb-12 tracking-tight drop-shadow-2xl">
            Ready to <span className="italic font-serif text-metallic">ascend?</span>
          </h2>
          <Link to="/app">
            <Button className="bg-white hover:bg-gray-200 text-black text-sm font-bold tracking-[0.2em] rounded-full px-12 py-8 transition-transform hover:scale-105 duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
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
