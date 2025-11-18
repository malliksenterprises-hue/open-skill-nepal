'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { dashboardAPI } from '../../../utils/api'
import DashboardLayout from '../../../components/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../../components/Card'

export default function AdminDashboard() {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (token) {
        const dashboardData = await dashboardAPI.getAdminData(token)
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
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage schools and teachers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Managed Schools</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data?.stats.managedSchools}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Total Teachers</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data?.stats.totalTeachers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Active Students</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data?.stats.activeStudents}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-500">Pending Approvals</p>
            <p className="text-2xl font-semibold text-gray-900">
              {data?.stats.pendingApprovals}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">Managed Schools</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.schools.map((school) => (
              <div key={school.id} className="flex justify-between items-center py-3 border-b border-gray-200">
                <div>
                  <h4 className="font-medium text-gray-900">{school.name}</h4>
                  <p className="text-sm text-gray-500">
                    {school.teachers} teachers • {school.students} students
                  </p>
                </div>
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  View Details
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
