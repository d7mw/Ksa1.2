import React from 'react';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-zinc-100 overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto flex">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <main className="flex-1 min-w-0 md:border-x border-zinc-900 min-h-screen pb-20 md:pb-0">
          {children}
        </main>

        {/* Right sidebar only on large screens */}
        <RightSidebar />
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
};

export default Layout;
