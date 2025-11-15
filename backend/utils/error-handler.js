const ErrorMessages = {
  DEVICE_LIMIT_EXCEEDED: {
    code: 'DEVICE_LIMIT_EXCEEDED',
    message: 'device-limit exceeded',
    details: 'Your school has reached the maximum number of concurrent devices for this class'
  },
  
  STUDENT_JOIN_BLOCKED: {
    code: 'STUDENT_JOIN_BLOCKED', 
    message: 'students cannot join live class',
    details: 'Students can only access recorded content, not live classes'
  },
  
  UNAUTHENTICATED: {
    code: 'UNAUTHENTICATED',
    message: 'Not authenticated',
    details: 'Please log in to access this resource'
  },
  
  ROOM_NOT_ACTIVE: {
    code: 'ROOM_NOT_ACTIVE',
    message: 'Room not active',
    details: 'This class is not currently active. Please check the schedule.'
  }
};

function sendError(ws, errorType, additionalDetails = null) {
  const error = { ...ErrorMessages[errorType] };
  if (additionalDetails) {
    error.details = additionalDetails;
  }
  
  ws.send(JSON.stringify({
    type: 'error',
    error: error
  }));
}

module.exports = { ErrorMessages, sendError };
