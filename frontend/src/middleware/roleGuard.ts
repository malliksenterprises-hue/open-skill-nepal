/**
 * Role Guard Middleware
 * Protects routes based on user roles and permissions
 * Used in Next.js middleware and client-side route protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken, decodeToken, TokenPayload } from '../services/auth.service';

// Role hierarchy (highest to lowest)
export enum UserRole {
  SUPER_ADMIN = 'superAdmin',
  ADMIN = 'admin',
  TEACHER = 'teacher',
  SCHOOL_ADMIN = 'schoolAdmin',
  CLASS_LOGIN = 'classLogin',
  STUDENT = 'student',
}

// Route permissions configuration
interface RoutePermission {
  path: string;
  allowedRoles: UserRole[];
  exact?: boolean;
  redirectTo?: string;
}

// Define protected routes and their allowed roles
const protectedRoutes: RoutePermission[] = [
  // Super Admin routes
  { 
    path: '/super-admin', 
    allowedRoles: [UserRole.SUPER_ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/create', 
    allowedRoles: [UserRole.SUPER_ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/verify', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  
  // Admin routes (Open Skill Nepal Manager)
  { 
    path: '/admin', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/live-classes', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/teachers', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/schools', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/admin/videos', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    redirectTo: '/unauthorized'
  },
  
  // Teacher routes
  { 
    path: '/teacher', 
    allowedRoles: [UserRole.TEACHER],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/teacher/live-class', 
    allowedRoles: [UserRole.TEACHER],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/teacher/videos', 
    allowedRoles: [UserRole.TEACHER],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/teacher/notes', 
    allowedRoles: [UserRole.TEACHER],
    redirectTo: '/unauthorized'
  },
  
  // School Admin routes
  { 
    path: '/school-admin', 
    allowedRoles: [UserRole.SCHOOL_ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/school-admin/class-logins', 
    allowedRoles: [UserRole.SCHOOL_ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/school-admin/students', 
    allowedRoles: [UserRole.SCHOOL_ADMIN],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/school-admin/devices', 
    allowedRoles: [UserRole.SCHOOL_ADMIN],
    redirectTo: '/unauthorized'
  },
  
  // Class Login routes (Live classroom access)
  { 
    path: '/live-class/join', 
    allowedRoles: [UserRole.CLASS_LOGIN],
    redirectTo: '/login?type=class'
  },
  { 
    path: '/live-class/room', 
    allowedRoles: [UserRole.CLASS_LOGIN],
    redirectTo: '/login?type=class'
  },
  { 
    path: '/live-class/stream', 
    allowedRoles: [UserRole.CLASS_LOGIN],
    redirectTo: '/login?type=class'
  },
  
  // Student routes (Recorded content only)
  { 
    path: '/student', 
    allowedRoles: [UserRole.STUDENT],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/student/recorded-classes', 
    allowedRoles: [UserRole.STUDENT],
    redirectTo: '/unauthorized'
  },
  { 
    path: '/student/notes', 
    allowedRoles: [UserRole.STUDENT],
    redirectTo: '/unauthorized'
  },
  
  // Block students from live class routes
  { 
    path: '/live-class', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER, UserRole.CLASS_LOGIN],
    redirectTo: '/student/recorded-classes'
  },
  
  // Block Class Login from admin routes
  { 
    path: '/admin', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT],
    redirectTo: '/live-class/join'
  },
  { 
    path: '/teacher', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.STUDENT],
    redirectTo: '/live-class/join'
  },
];

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/auth/google',
  '/auth/google/callback',
  '/unauthorized',
  '/forbidden',
  '/not-found',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
];

/**
 * Check if a route matches the protected route pattern
 */
function matchesRoute(requestPath: string, routeConfig: RoutePermission): boolean {
  if (routeConfig.exact) {
    return requestPath === routeConfig.path;
  }
  return requestPath.startsWith(routeConfig.path);
}

/**
 * Get the role hierarchy level
 * Higher number = higher privilege
 */
function getRoleLevel(role: UserRole): number {
  const hierarchy = {
    [UserRole.SUPER_ADMIN]: 6,
    [UserRole.ADMIN]: 5,
    [UserRole.TEACHER]: 4,
    [UserRole.SCHOOL_ADMIN]: 3,
    [UserRole.CLASS_LOGIN]: 2,
    [UserRole.STUDENT]: 1,
  };
  return hierarchy[role] || 0;
}

/**
 * Check if user has permission to access a route based on role hierarchy
 */
function hasRolePermission(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  // User's role is explicitly allowed
  if (allowedRoles.includes(userRole)) {
    return true;
  }
  
  // Check role hierarchy (higher roles can access lower role routes in some cases)
  const userRoleLevel = getRoleLevel(userRole);
  
  // Super Admin can access everything
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  // Admin can access everything except Super Admin specific routes
  if (userRole === UserRole.ADMIN && !allowedRoles.includes(UserRole.SUPER_ADMIN)) {
    return true;
  }
  
  // Special case: Teachers can't access School Admin routes and vice versa
  if ((userRole === UserRole.TEACHER && allowedRoles.includes(UserRole.SCHOOL_ADMIN)) ||
      (userRole === UserRole.SCHOOL_ADMIN && allowedRoles.includes(UserRole.TEACHER))) {
    return false;
  }
  
  // Block students from any non-student routes (except public routes)
  if (userRole === UserRole.STUDENT && 
      !allowedRoles.includes(UserRole.STUDENT) &&
      allowedRoles.some(role => role !== UserRole.STUDENT)) {
    return false;
  }
  
  // Block Class Login from any non-Class Login routes
  if (userRole === UserRole.CLASS_LOGIN && 
      !allowedRoles.includes(UserRole.CLASS_LOGIN)) {
    return false;
  }
  
  return false;
}

/**
 * Next.js Middleware for route protection
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Skip middleware for API routes (handled by backend)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Get token from cookies
  const token = getToken(request);
  
  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Decode token to get user info
  const decodedToken = decodeToken(token);
  
  if (!decodedToken) {
    // Invalid token, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'invalid_token');
    return NextResponse.redirect(loginUrl);
  }
  
  const userRole = decodedToken.role as UserRole;
  
  // Find matching route configuration
  const matchedRoute = protectedRoutes.find(route => matchesRoute(pathname, route));
  
  if (matchedRoute) {
    // Check if user has permission for this route
    if (!hasRolePermission(userRole, matchedRoute.allowedRoles)) {
      // Redirect to unauthorized or specific redirect
      const redirectTo = matchedRoute.redirectTo || '/unauthorized';
      
      // Special redirects based on role
      if (userRole === UserRole.STUDENT && pathname.startsWith('/live-class')) {
        return NextResponse.redirect(new URL('/student/recorded-classes', request.url));
      }
      
      if (userRole === UserRole.CLASS_LOGIN && (pathname.startsWith('/admin') || pathname.startsWith('/teacher'))) {
        return NextResponse.redirect(new URL('/live-class/join', request.url));
      }
      
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }
  
  // Allow access
  return NextResponse.next();
}

/**
 * Client-side route guard hook
 */
export function useRouteGuard() {
  const checkAccess = useCallback(async (path: string): Promise<{
    allowed: boolean;
    redirectTo?: string;
    reason?: string;
  }> => {
    try {
      // Get token from client storage
      const token = getToken();
      
      if (!token) {
        return {
          allowed: false,
          redirectTo: '/login',
          reason: 'Authentication required',
        };
      }
      
      // Decode token
      const decodedToken = decodeToken(token);
      
      if (!decodedToken) {
        return {
          allowed: false,
          redirectTo: '/login',
          reason: 'Invalid token',
        };
      }
      
      const userRole = decodedToken.role as UserRole;
      
      // Find matching route
      const matchedRoute = protectedRoutes.find(route => matchesRoute(path, route));
      
      if (matchedRoute) {
        if (!hasRolePermission(userRole, matchedRoute.allowedRoles)) {
          return {
            allowed: false,
            redirectTo: matchedRoute.redirectTo || '/unauthorized',
            reason: 'Insufficient permissions',
          };
        }
      }
      
      return { allowed: true };
    } catch (error) {
      console.error('Route guard error:', error);
      return {
        allowed: false,
        redirectTo: '/login',
        reason: 'Error checking permissions',
      };
    }
  }, []);
  
  return { checkAccess };
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(userRole: UserRole, feature: string): boolean {
  const featurePermissions: Record<string, UserRole[]> = {
    // Admin features
    'create_admins': [UserRole.SUPER_ADMIN],
    'verify_teachers': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    'verify_schools': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    'set_device_limits': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    'manage_all_schools': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    'rename_all_content': [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    
    // Teacher features
    'teach_live_classes': [UserRole.TEACHER],
    'screen_share': [UserRole.TEACHER],
    'control_classroom_mic': [UserRole.TEACHER],
    'upload_videos': [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
    'schedule_videos': [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
    'add_text_notes': [UserRole.TEACHER],
    'rename_own_content': [UserRole.TEACHER],
    
    // School Admin features
    'manage_class_logins': [UserRole.SCHOOL_ADMIN],
    'verify_students': [UserRole.SCHOOL_ADMIN],
    'reset_devices': [UserRole.SCHOOL_ADMIN],
    
    // Class Login features
    'access_live_classes': [UserRole.CLASS_LOGIN],
    
    // Student features
    'access_recorded_classes': [UserRole.STUDENT],
    'access_text_notes': [UserRole.STUDENT],
  };
  
  const allowedRoles = featurePermissions[feature] || [];
  return hasRolePermission(userRole, allowedRoles);
}

/**
 * Get user's dashboard route based on role
 */
export function getUserDashboardRoute(userRole: UserRole): string {
  switch (userRole) {
    case UserRole.SUPER_ADMIN:
      return '/super-admin/dashboard';
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.TEACHER:
      return '/teacher/dashboard';
    case UserRole.SCHOOL_ADMIN:
      return '/school-admin/dashboard';
    case UserRole.CLASS_LOGIN:
      return '/live-class/join';
    case UserRole.STUDENT:
      return '/student/dashboard';
    default:
      return '/';
  }
}

/**
 * Get readable role name
 */
export function getRoleName(userRole: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.ADMIN]: 'Admin',
    [UserRole.TEACHER]: 'Teacher',
    [UserRole.SCHOOL_ADMIN]: 'School Admin',
    [UserRole.CLASS_LOGIN]: 'Class Login',
    [UserRole.STUDENT]: 'Student',
  };
  
  return roleNames[userRole] || 'Unknown Role';
}

// Export config for Next.js middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
