'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Grid,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Add,
    Videocam,
    Schedule,
    People,
    PlayArrow,
    Stop,
    Delete
} from '@mui/icons-material';
import { toast } from 'react-toastify';

export default function TeacherLiveClasses() {
    const router = useRouter();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [classes, setClasses] = useState([]);
    const [formData, setFormData] = useState({
        classId: '',
        title: '',
        description: '',
        maxParticipants: 50
    });

    useEffect(() => {
        fetchSessions();
        fetchClasses();
    }, []);

    const fetchSessions = async () => {
        try {
            const response = await fetch('/api/live-sessions/school/active', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setSessions(data.data);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
            toast.error('Failed to load sessions');
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const response = await fetch('/api/classes/teacher', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setClasses(data.data);
            }
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const handleCreateSession = async () => {
        try {
            const response = await fetch('/api/live-sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                toast.success('Live session created successfully');
                setOpenDialog(false);
                fetchSessions();
            } else {
                toast.error(data.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            toast.error('Failed to create session');
        }
    };

    const handleStartSession = async (sessionId) => {
        try {
            const response = await fetch(`/api/live-sessions/${sessionId}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                toast.success('Session started');
                fetchSessions();
                // Navigate to live class room
                router.push(`/dashboard/teacher/live-classes/${sessionId}`);
            } else {
                toast.error(data.error || 'Failed to start session');
            }
        } catch (error) {
            console.error('Error starting session:', error);
            toast.error('Failed to start session');
        }
    };

    const handleEndSession = async (sessionId) => {
        try {
            const response = await fetch(`/api/live-sessions/${sessionId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ recordingUrl: '' })
            });

            const data = await response.json();
            
            if (data.success) {
                toast.success('Session ended');
                fetchSessions();
            } else {
                toast.error(data.error || 'Failed to end session');
            }
        } catch (error) {
            console.error('Error ending session:', error);
            toast.error('Failed to end session');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'success';
            case 'scheduled': return 'warning';
            case 'ended': return 'default';
            default: return 'default';
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" gutterBottom>
                    Live Classes
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenDialog(true)}
                >
                    Create Live Class
                </Button>
            </Box>

            {sessions.length === 0 ? (
                <Alert severity="info">
                    No live sessions found. Create your first live class to get started.
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {sessions.map((session) => (
                        <Grid item xs={12} md={6} lg={4} key={session._id}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                                        <Videocam color="primary" />
                                        <Typography variant="h6">
                                            {session.title}
                                        </Typography>
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary" paragraph>
                                        {session.description}
                                    </Typography>

                                    <Box display="flex" flexDirection="column" gap={1}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Schedule fontSize="small" />
                                            <Typography variant="caption">
                                                Started: {new Date(session.startedAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <People fontSize="small" />
                                            <Typography variant="caption">
                                                Participants: {session.participants?.filter(p => !p.leftAt).length || 0}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box mt={2}>
                                        <Chip
                                            label={session.status.toUpperCase()}
                                            color={getStatusColor(session.status)}
                                            size="small"
                                        />
                                    </Box>
                                </CardContent>

                                <CardActions>
                                    {session.status === 'scheduled' && (
                                        <Button
                                            size="small"
                                            startIcon={<PlayArrow />}
                                            onClick={() => handleStartSession(session.sessionId)}
                                        >
                                            Start
                                        </Button>
                                    )}
                                    
                                    {session.status === 'active' && (
                                        <>
                                            <Button
                                                size="small"
                                                color="primary"
                                                onClick={() => router.push(`/dashboard/teacher/live-classes/${session.sessionId}`)}
                                            >
                                                Join Class
                                            </Button>
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={<Stop />}
                                                onClick={() => handleEndSession(session.sessionId)}
                                            >
                                                End
                                            </Button>
                                        </>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Create Session Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Live Class</DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} mt={2}>
                        <FormControl fullWidth required>
                            <InputLabel>Select Class</InputLabel>
                            <Select
                                value={formData.classId}
                                label="Select Class"
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                            >
                                {classes.map((cls) => (
                                    <MenuItem key={cls._id} value={cls._id}>
                                        {cls.name} - {cls.subject} (Grade {cls.grade})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Title"
                            fullWidth
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />

                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />

                        <TextField
                            label="Maximum Participants"
                            type="number"
                            fullWidth
                            value={formData.maxParticipants}
                            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 50 })}
                            inputProps={{ min: 1, max: 100 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateSession}
                        disabled={!formData.classId || !formData.title}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
