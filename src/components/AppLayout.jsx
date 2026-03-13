import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="max-w-lg mx-auto">
        <Outlet />
      </div>
      <BottomNav
        onMenuClick={() => setSidebarOpen(true)}
      />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
