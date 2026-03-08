import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="max-w-lg mx-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
