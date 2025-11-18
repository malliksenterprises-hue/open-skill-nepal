'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { dashboardAPI } from '../../../utils/api'
import DashboardLayout from '../../../components/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../../components/Card'

export default function TeacherDashboard() {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (token) {
        const dashboardData = await dashboardAPI.getTeacherData(token)
        setData(dashboardData)
        setLoading(false)
      }
    }
    loadData()
  }, [token])

  if (loading) {
    return <DashboardLayout>Loading...</DashboardLayout>
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600 mt-2">View your class schedule and manage classes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Today's Schedule</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.schedule.map((classItem) => (
                <div key={classItem.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{classItem.subject}</h4>
                    <p className="text-sm text-gray-500">{classItem.class}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{classItem.time}</p>
                    <p className="text-sm text-green-600">Scheduled</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Upcoming Classes</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.upcomingClasses.map((classItem) => (
                <div key={classItem.id} className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900">{classItem.subject}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Date: {classItem.date} • Students: {classItem.students}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
