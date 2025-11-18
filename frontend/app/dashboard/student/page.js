'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { dashboardAPI } from '../../../utils/api'
import DashboardLayout from '../../../components/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../../components/Card'

export default function StudentDashboard() {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (token) {
        const dashboardData = await dashboardAPI.getStudentData(token)
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
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-2">Access your courses and track progress</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">My Courses</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.enrolledCourses.map((course) => (
                <div key={course.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{course.name}</h4>
                    <span className="text-sm font-medium text-primary-600">
                      {course.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full" 
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                  <button className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Continue Learning
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">Recommended Courses</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recommendedCourses.map((course) => (
                <div key={course.id} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                  <h4 className="font-medium text-gray-900 mb-2">{course.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    Free open-source course available now
                  </p>
                  <button className="w-full bg-primary-50 text-primary-700 py-2 px-4 rounded text-sm font-medium hover:bg-primary-100 transition-colors">
                    Enroll Now
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
