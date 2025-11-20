'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../utils/api'

// Create Auth Context
const AuthContext = createContext()

/**
 * AuthProvider component that manages authentication state
 * Provides user, login, logout functions to all components
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  // Check if user is logged in on component mount
  useEffect(() => {
    checkAuth()
  }, [])

  /**
   * Check if user has valid token and get user data
   */
  const checkAuth = async () => {
    try {
      const storedToken = localStorage.getItem('openSkillToken')
      if (storedToken) {
        setToken(storedToken)
        const userData = await authAPI.getMe(storedToken)
        setUser(userData)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('openSkillToken')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Login user and store token
   */
  const login = async (email, password) => {
    try {
      console.log('🔄 AuthContext: Attempting login...') // Add logging
      const response = await authAPI.login(email, password)
      console.log('✅ AuthContext: Login response:', response) // Add logging
      
      const { token: newToken, user: userData } = response
      
      localStorage.setItem('openSkillToken', newToken)
      setToken(newToken)
      setUser(userData)
      
      return { success: true, user: userData }
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error) // Add logging
      
      // FIXED: Correct error property access
      return { 
        success: false, 
        message: error.message || error.data?.message || 'Login failed' 
      }
    }
  }

  /**
   * Google OAuth login
   */
  const googleLogin = async (googleData) => {
    try {
      console.log('🔄 AuthContext: Attempting Google login...')
      const response = await authAPI.googleLogin(googleData)
      console.log('✅ AuthContext: Google login response:', response)
      
      const { token: newToken, user: userData } = response
      
      localStorage.setItem('openSkillToken', newToken)
      setToken(newToken)
      setUser(userData)
      
      return { success: true, user: userData }
    } catch (error) {
      console.error('❌ AuthContext: Google login error:', error)
      
      // FIXED: Correct error property access
      return { 
        success: false, 
        message: error.message || error.data?.message || 'Google login failed' 
      }
    }
  }

  /**
   * Logout user and clear token
   */
  const logout = async () => {
    try {
      if (token) {
        await authAPI.logout(token)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('openSkillToken')
      setToken(null)
      setUser(null)
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    googleLogin,
    logout,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Custom hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
