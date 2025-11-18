'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { dashboardAPI } from '../../../utils/api'
import DashboardLayout from '../../../components/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../../components/Card'

export default function SchoolAdminDashboard() {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (token) {
        const dashboardData = await dashboardAPI.getSchoolAdminData(token)
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
        <h1 className="text-3xl font-bold text-gray-900">School Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your school and monitor live classes</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {data?.schoolInfo.students}
            </div>
            <p className="text-gray-600">Total Students</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {data?.schoolInfo.teachers}
            </div>
            <p className="text-gray-600">Teachers</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {data?.schoolInfo.classes}
            </div>
            <p className="text-gray-600">Active Classes</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">Live Classes</h3>
        </CardHeader>
        <CardContent>
          {data?.liveClasses.length > 0 ? (
            <div className="space-y-4">
              {data.liveClasses.map((classItem) => (
                <div key={classItem.id} className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">{classItem.subject}</h4>
                    <p className="text-sm text-gray-500">Teacher: {classItem.teacher}</p>
                  </div>
                  <div className="flex items-center">
                    <span className="flex h-3 w-3">
                      <span className="animate-ping absolute h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="ml-2 text-sm font-medium text-red-600">{classItem.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No live classes at the moment</p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
