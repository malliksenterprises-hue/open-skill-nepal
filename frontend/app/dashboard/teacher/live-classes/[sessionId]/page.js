'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
    Box,
    Container,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material';
import { ExitToApp } from '@mui/icons-material';
import { toast } from 'react-toastify';

// Dynamically import LiveClassRoom to avoid SSR issues
const LiveClassRoom = dynamic(
    () => import('@/components/live-class/LiveClassRoom'),
    { ssr: false }
);

export default function LiveClassPage() {
    const params = useParams();
    const router = useRouter();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        initialize();
    }, [params.sessionId]);

    const initialize = async () => {
        try {
            setLoading(true);
            
            // Get user from localStorage
            const userData = localStorage.getItem('user');
            if (!userData) {
                router.push('/auth/login');
                return;
            }

            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);

            // Check access to session
            const response = await fetch(`/api/live-sessions/${params.sessionId}/check-access`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            
            if (!data.success || !data.canAccess) {
                setError('You do not have permission to access this live session');
                return;
            }

            // Get session details
            const sessionResponse = await fetch(`/api/live-sessions/${params.sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const sessionData = await sessionResponse.json();
            
            if (sessionData.success) {
                setSession(sessionData.data);
            } else {
                setError(sessionData.error || 'Failed to load session');
            }

        } catch (error) {
            console.error('Initialization error:', error);
            setError('Failed to initialize live class');
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveClass = () => {
        if (window.confirm('Are you sure you want to leave the class?')) {
            router.push('/dashboard/teacher/live-classes');
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
                <Typography variant="body1" ml={2}>
                    Loading Live Classroom...
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ mt: 8 }}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                    <Button
                        variant="contained"
                        onClick={() => router.push('/dashboard/teacher/live-classes')}
                    >
                        Back to Live Classes
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Paper sx={{ 
                p: 2, 
                borderRadius: 0,
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Box>
                    <Typography variant="h6">
                        {session?.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Class: {session?.classId?.name} • Status: {session?.status}
                    </Typography>
                </Box>
                
                <Button
                    variant="contained"
                    color="error"
                    startIcon={<ExitToApp />}
                    onClick={handleLeaveClass}
                >
                    Leave Class
                </Button>
            </Paper>

            {/* Live Class Room */}
            {session && user && (
                <LiveClassRoom
                    sessionId={session.sessionId}
                    roomId={session.roomId}
                    user={user}
                    userRole={user.role}
                />
            )}

            <Snackbar
                open={!!error}
                autoHideDuration={6000}
                onClose={() => setError(null)}
                message={error}
            />
        </Box>
    );
}
