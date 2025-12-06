'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Divider
} from '@mui/material';
import { Send } from '@mui/icons-material';

const ChatPanel = ({ sessionId, user, socket, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (socket) {
            socket.on('new-message', handleNewMessage);
            loadChatHistory();
        }

        return () => {
            if (socket) {
                socket.off('new-message', handleNewMessage);
            }
        };
    }, [socket]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadChatHistory = async () => {
        try {
            const response = await fetch(`/api/live-sessions/${sessionId}/chat?limit=50`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setMessages(data.data);
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    };

    const handleNewMessage = (message) => {
        setMessages(prev => [...prev, message]);
    };

    const sendMessage = () => {
        if (!newMessage.trim() || !socket) return;

        socket.emit('send-message', {
            sessionId,
            message: newMessage,
            messageType: 'text'
        });

        setNewMessage('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">Chat</Typography>
            </Box>

            {/* Messages List */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <List>
                    {messages.map((message, index) => (
                        <React.Fragment key={message._id || index}>
                            <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                                <ListItemAvatar>
                                    <Avatar sx={{ 
                                        bgcolor: message.senderRole === 'teacher' ? 'primary.main' : 'secondary.main'
                                    }}>
                                        {message.senderName?.charAt(0) || message.senderRole?.charAt(0)}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="subtitle2">
                                                {message.senderName || message.senderRole}
                                                {message.senderRole === 'teacher' && (
                                                    <Typography 
                                                        component="span" 
                                                        variant="caption" 
                                                        sx={{ ml: 1, color: 'primary.main' }}
                                                    >
                                                        (Teacher)
                                                    </Typography>
                                                )}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatTime(message.timestamp)}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <Typography
                                            variant="body2"
                                            color="text.primary"
                                            sx={{ wordBreak: 'break-word' }}
                                        >
                                            {message.message}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                            {index < messages.length - 1 && <Divider variant="inset" component="li" />}
                        </React.Fragment>
                    ))}
                    <div ref={messagesEndRef} />
                </List>
            </Box>

            {/* Message Input */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={3}
                        variant="outlined"
                        size="small"
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <IconButton color="primary" onClick={sendMessage}>
                        <Send />
                    </IconButton>
                </Box>
            </Box>
        </Paper>
    );
};

export default ChatPanel;
