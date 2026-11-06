'use client';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="text-center max-w-2xl mx-auto space-y-6">
        <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium text-sm tracking-wide uppercase">
          Pokhara, Nepal • One-Day Exclusive
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-orange-300 to-amber-500 bg-clip-text text-transparent">
          Pratikshya Kitchen Suppliers
        </h1>
        <p className="text-xl md:text-2xl text-slate-300 font-light">
          Lucky Spin Promotional Event
        </p>
        <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/50 backdrop-blur shadow-xl">
          <p className="text-slate-400 text-sm">
            Kiosk station ready. Spin terminal will initialize upon customer mobile and invoice verification.
          </p>
        </div>
      </div>
    </main>
  );
}

