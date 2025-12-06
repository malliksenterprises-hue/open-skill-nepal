'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import {
    Box,
    Grid,
    Paper,
    Typography,
    IconButton,
    Button,
    Chip,
    Badge,
    CircularProgress
} from '@mui/material';
import {
    Mic,
    MicOff,
    Videocam,
    VideocamOff,
    ScreenShare,
    StopScreenShare,
    Chat,
    People,
    HandRaise,
    Fullscreen,
    FullscreenExit
} from '@mui/icons-material';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
import { toast } from 'react-toastify';

const LiveClassRoom = ({ sessionId, roomId, user, userRole }) => {
    const [socket, setSocket] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState([]);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [handRaised, setHandRaised] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    
    const localVideoRef = useRef(null);
    const remoteVideosRef = useRef({});
    const containerRef = useRef(null);
    const deviceRef = useRef(null);
    const producerTransportRef = useRef(null);
    const consumerTransportRef = useRef(null);
    const producersRef = useRef({});
    const consumersRef = useRef({});

    useEffect(() => {
        initializeConnection();
        
        return () => {
            cleanup();
        };
    }, []);

    const initializeConnection = async () => {
        try {
            setConnectionStatus('connecting');
            
            // Generate device fingerprint
            const deviceFingerprint = generateDeviceFingerprint();
            
            // Connect to WebSocket
            const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000', {
                auth: {
                    token: localStorage.getItem('token'),
                    deviceFingerprint
                },
                transports: ['websocket']
            });

            socket.on('connect', () => {
                console.log('Socket connected');
                setConnectionStatus('connected');
                joinRoom(socket);
            });

            socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                setConnectionStatus('error');
                toast.error('Connection error');
            });

            socket.on('peer-joined', handlePeerJoined);
            socket.on('peer-left', handlePeerLeft);
            socket.on('new-message', handleNewMessage);

            setSocket(socket);

        } catch (error) {
            console.error('Initialization error:', error);
            setConnectionStatus('error');
            toast.error('Failed to initialize connection');
        }
    };

    const generateDeviceFingerprint = () => {
        const components = [
            navigator.userAgent,
            navigator.platform,
            navigator.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ];
        
        return components.join('|');
    };

    const joinRoom = async (socket) => {
        socket.emit('join-room', {
            roomId,
            sessionId
        }, async (response) => {
            if (response && response.success) {
                await initializeMediasoup(response);
                await getLocalMedia();
                setConnectionStatus('ready');
            } else {
                toast.error(response?.error || 'Failed to join room');
                setConnectionStatus('error');
            }
        });
    };

    const initializeMediasoup = async (roomData) => {
        try {
            deviceRef.current = new mediasoupClient.Device();
            
            // For now, use simple configuration
            // In production, you'd get routerRtpCapabilities from server
            
            await createTransports();
            
        } catch (error) {
            console.error('Mediasoup initialization error:', error);
            throw error;
        }
    };

    const createTransports = async () => {
        // This would create WebRTC transports
        // Simplified for now
        console.log('Creating WebRTC transports...');
    };

    const getLocalMedia = async () => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

        } catch (error) {
            console.error('Error getting local media:', error);
            
            if (error.name === 'NotAllowedError') {
                toast.error('Camera/microphone access denied');
            } else {
                toast.error('Failed to access camera/microphone');
            }
        }
    };

    const toggleAudio = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioMuted(!audioTrack.enabled);
            
            toast.success(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted');
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoMuted(!videoTrack.enabled);
            
            toast.success(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off');
        }
    };

    const toggleScreenShare = async () => {
        try {
            if (!isScreenSharing) {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });
                
                // Handle screen sharing
                setIsScreenSharing(true);
                toast.success('Screen sharing started');
                
                stream.getVideoTracks()[0].onended = () => {
                    setIsScreenSharing(false);
                    toast.info('Screen sharing stopped');
                };
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            toast.error('Failed to start screen sharing');
        }
    };

    const raiseHand = () => {
        if (socket && userRole === 'school_admin') {
            socket.emit('raise-hand', { sessionId });
            setHandRaised(true);
            toast.info('Hand raised');
            
            setTimeout(() => {
                setHandRaised(false);
            }, 30000);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setFullscreen(true);
        } else {
            document.exitFullscreen();
            setFullscreen(false);
        }
    };

    const handlePeerJoined = (data) => {
        toast.info(`${data.role === 'teacher' ? 'Teacher' : 'Participant'} joined`);
    };

    const handlePeerLeft = (data) => {
        toast.info('Participant left');
    };

    const handleNewMessage = (data) => {
        // Messages handled by ChatPanel
        console.log('New message:', data);
    };

    const cleanup = () => {
        if (socket) {
            socket.disconnect();
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
    };

    if (connectionStatus === 'error') {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <Typography color="error">
                    Connection error. Please refresh the page.
                </Typography>
            </Box>
        );
    }

    return (
        <Box ref={containerRef} sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Status Bar */}
            <Paper sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">
                    Live Class: {sessionId}
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                    <Chip 
                        label={connectionStatus}
                        size="small"
                        color={connectionStatus === 'ready' ? 'success' : 'warning'}
                    />
                    <Chip 
                        label={`Role: ${userRole}`}
                        size="small"
                        variant="outlined"
                    />
                </Box>
            </Paper>

            {/* Main Content */}
            <Box sx={{ flex: 1, display: 'flex', p: 2, gap: 2 }}>
                {/* Video Area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {connectionStatus !== 'ready' ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                            <CircularProgress />
                            <Typography ml={2}>
                                {connectionStatus === 'connecting' ? 'Connecting...' : 'Initializing...'}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Teacher/Remote Videos */}
                            <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                                {/* Local Video */}
                                <Paper sx={{ position: 'relative', bgcolor: 'black', borderRadius: 1, overflow: 'hidden' }}>
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <Box sx={{ 
                                        position: 'absolute', 
                                        bottom: 8, 
                                        left: 8,
                                        bgcolor: 'rgba(0,0,0,0.7)',
                                        color: 'white',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1
                                    }}>
                                        <Typography variant="caption">
                                            {user?.name} (You)
                                        </Typography>
                                    </Box>
                                    {isAudioMuted && (
                                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                                            <MicOff sx={{ color: 'red' }} />
                                        </Box>
                                    )}
                                </Paper>

                                {/* Placeholder for remote videos */}
                                <Paper sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'grey.100' }}>
                                    <Typography color="text.secondary">
                                        Waiting for other participants...
                                    </Typography>
                                </Paper>
                            </Box>
                        </>
                    )}
                </Box>

                {/* Chat Panel */}
                {showChat && (
                    <Box sx={{ width: 350 }}>
                        <ChatPanel 
                            sessionId={sessionId}
                            user={user}
                            socket={socket}
                            onClose={() => setShowChat(false)}
                        />
                    </Box>
                )}
            </Box>

            {/* Control Bar */}
            <Paper sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                <IconButton
                    color={isAudioMuted ? "error" : "primary"}
                    onClick={toggleAudio}
                    title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
                >
                    {isAudioMuted ? <MicOff /> : <Mic />}
                </IconButton>

                <IconButton
                    color={isVideoMuted ? "error" : "primary"}
                    onClick={toggleVideo}
                    title={isVideoMuted ? "Turn on camera" : "Turn off camera"}
                >
                    {isVideoMuted ? <VideocamOff /> : <Videocam />}
                </IconButton>

                <IconButton
                    color={isScreenSharing ? "error" : "primary"}
                    onClick={toggleScreenShare}
                    title={isScreenSharing ? "Stop screen share" : "Start screen share"}
                >
                    {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
                </IconButton>

                {userRole === 'school_admin' && (
                    <IconButton
                        color={handRaised ? "warning" : "default"}
                        onClick={raiseHand}
                        title={handRaised ? "Lower hand" : "Raise hand"}
                    >
                        <Badge color="warning" variant="dot" invisible={!handRaised}>
                            <HandRaise />
                        </Badge>
                    </IconButton>
                )}

                <IconButton
                    color={showChat ? "primary" : "default"}
                    onClick={() => setShowChat(!showChat)}
                    title={showChat ? "Hide chat" : "Show chat"}
                >
                    <Chat />
                </IconButton>

                <IconButton
                    color={showParticipants ? "primary" : "default"}
                    onClick={() => setShowParticipants(!showParticipants)}
                    title="Show participants"
                >
                    <People />
                </IconButton>

                <IconButton
                    onClick={toggleFullscreen}
                    title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                    {fullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
            </Paper>

            {/* Participants Panel */}
            {showParticipants && (
                <ParticipantsPanel
                    sessionId={sessionId}
                    userRole={userRole}
                    socket={socket}
                    onClose={() => setShowParticipants(false)}
                />
            )}
        </Box>
    );
};

export default LiveClassRoom;
