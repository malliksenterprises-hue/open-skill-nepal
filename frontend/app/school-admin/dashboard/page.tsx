'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Class } from '@/types';

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schedules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setClasses(data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">School Admin Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome, {user?.name}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((classItem) => (
          <div key={classItem.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-2">
              {classItem.grade} - {classItem.subject}
            </h3>
            <p className="text-gray-600 mb-4">
              Schedule: {new Date(classItem.schedule).toLocaleString()}
            </p>
            <button
              onClick={() => window.open(`/school-admin/live/${classItem.roomId}`, '_blank')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
            >
              Join Live Class
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
