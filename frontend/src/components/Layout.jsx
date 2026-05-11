import React from 'react';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';

const Layout = ({ children, onCompose }) => {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-[1280px] mx-auto flex">
        <Sidebar onCompose={onCompose} />
        <main className="flex-1 min-w-0 border-x border-zinc-900 min-h-screen">
          {children}
        </main>
        <RightSidebar />
      </div>
    </div>
  );
};

export default Layout;
