// Configuration
const CONFIG = {
    // Change this URL for production deployment
    SERVER_URL: 'http://localhost:3000', // For local development
    // SERVER_URL: 'https://your-railway-app.railway.app', // For production
    MAX_MESSAGE_LENGTH: 500,
    RECONNECT_ATTEMPTS: 3,
    TOAST_DURATION: 3000
};

// DOM elements
const elements = {
    // Login elements
    loginContainer: document.getElementById('loginContainer'),
    loginForm: document.getElementById('loginForm'),
    userNameInput: document.getElementById('userName'),
    roomIdInput: document.getElementById('roomId'),
    
    // Chat interface elements
    chatInterface: document.getElementById('chatInterface'),
    messagesContainer: document.getElementById('messagesContainer'),
    messageForm: document.getElementById('messageForm'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    
    // Header elements
    connectionStatus: document.getElementById('connectionStatus'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.getElementById('statusText'),
    statusLoader: document.querySelector('.status-loader'),
    userDisplayName: document.getElementById('userDisplayName'),
    displayRoomId: document.getElementById('displayRoomId'),
    roomName: document.getElementById('roomName'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),
    
    // Other elements
    charCount: document.getElementById('charCount'),
    toast: document.getElementById('toast'),
    joinButton: document.querySelector('.join-button'),
    joinButtonLoader: document.querySelector('.join-button .loader'),
    joinButtonText: document.querySelector('.join-button .button-text'),
    joinButtonIcon: document.querySelector('.join-button .button-icon')
};

// Application state
let appState = {
    socket: null,
    userName: '',
    roomId: '',
    isConnected: false,
    isInRoom: false
};

// Initialize the application
function init() {
    setupLoginListeners();
    setupChatListeners();
    
    // Show login form initially
    showLoginForm();
}

// Connect to Socket.io server
function connectToServer() {
    try {
        appState.socket = io(CONFIG.SERVER_URL, {
            timeout: 5000,
            transports: ['websocket', 'polling']
        });

        setupSocketListeners();
    } catch (error) {
        console.error('Failed to connect to server:', error);
        showToast('Failed to connect to server', 'error');
        updateConnectionStatus('disconnected', 'Connection failed');
    }
}

// Handle login form submission
function handleLogin(e) {
    e.preventDefault();
    
    const userName = elements.userNameInput.value.trim();
    const roomId = elements.roomIdInput.value.trim();
    
    if (!userName || !roomId) {
        showToast('Please fill in all fields', 'warning');
        return;
    }
    
    if (userName.length > 30) {
        showToast('Name is too long (max 30 characters)', 'warning');
        return;
    }
    
    if (roomId.length > 20) {
        showToast('Room ID is too long (max 20 characters)', 'warning');
        return;
    }
    
    // Show loading state
    showJoinButtonLoading(true);
    
    // Store user data
    appState.userName = userName;
    appState.roomId = roomId;
    
    // Connect to server
    connectToServer();
}

// Validate login form
function validateLoginForm() {
    const userName = elements.userNameInput.value.trim();
    const roomId = elements.roomIdInput.value.trim();
    const isValid = userName.length > 0 && roomId.length > 0;
    
    const submitButton = elements.loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = !isValid;
}

// Show login form
function showLoginForm() {
    elements.loginContainer.style.display = 'flex';
    elements.chatInterface.style.display = 'none';
    elements.userNameInput.focus();
}

// Show chat interface
function showChatInterface() {
    elements.loginContainer.style.display = 'none';
    elements.chatInterface.style.display = 'flex';
    
    // Update header information
    elements.userDisplayName.textContent = appState.userName;
    elements.displayRoomId.textContent = appState.roomId;
    elements.roomName.textContent = `Room ${appState.roomId}`;
    
    // Focus on message input
    elements.messageInput.focus();
    
    // Initialize welcome message
    showWelcomeMessage();
    updateCharCounter();
}

// Leave room
function leaveRoom() {
    if (appState.socket) {
        appState.socket.emit('leave-room');
        appState.socket.disconnect();
    }
    
    // Reset state
    appState.isConnected = false;
    appState.isInRoom = false;
    appState.socket = null;
    
    // Hide loading states
    showJoinButtonLoading(false);
    showStatusLoading(false);
    
    // Clear form inputs
    elements.userNameInput.value = '';
    elements.roomIdInput.value = '';
    elements.messageInput.value = '';
    
    // Clear messages
    elements.messagesContainer.innerHTML = '';
    
    // Show login form
    showLoginForm();
    
    showToast('Left the room', 'success');
}

// Show/hide join button loading state
function showJoinButtonLoading(show) {
    if (show) {
        elements.joinButton.classList.add('loading');
        elements.joinButtonText.textContent = 'Connecting...';
        elements.joinButton.disabled = true;
    } else {
        elements.joinButton.classList.remove('loading');
        elements.joinButtonText.textContent = 'Join Room';
        elements.joinButton.disabled = false;
    }
}

// Show/hide status loading state
function showStatusLoading(show) {
    if (show) {
        elements.statusIndicator.style.display = 'none';
        elements.statusLoader.style.display = 'inline-flex';
    } else {
        elements.statusIndicator.style.display = 'block';
        elements.statusLoader.style.display = 'none';
    }
}

// Setup Socket.io event listeners
function setupSocketListeners() {
    // Connection established
    appState.socket.on('connect', () => {
        console.log('Connected to server');
        appState.isConnected = true;
        showStatusLoading(true);
        updateConnectionStatus('connected', 'Joining room...');
        
        // Join the room
        appState.socket.emit('join-room', {
            userName: appState.userName,
            roomId: appState.roomId
        });
    });

    // Room joined successfully
    appState.socket.on('room-joined', (data) => {
        console.log('Joined room:', data);
        appState.isInRoom = true;
        showJoinButtonLoading(false);
        showStatusLoading(false);
        showChatInterface();
        enableMessageInput();
        updateConnectionStatus('connected', 'Connected');
        showToast(`Joined room ${appState.roomId}`, 'success');
    });

    // Room join failed
    appState.socket.on('room-join-failed', (data) => {
        console.error('Failed to join room:', data.message);
        showJoinButtonLoading(false);
        showStatusLoading(false);
        showToast(data.message || 'Failed to join room', 'error');
        appState.socket.disconnect();
        showLoginForm();
    });

    // Connection error
    appState.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        appState.isConnected = false;
        showJoinButtonLoading(false);
        showStatusLoading(false);
        updateConnectionStatus('disconnected', 'Connection failed');
        showToast('Failed to connect to server', 'error');
        showLoginForm();
    });

    // Disconnection
    appState.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        appState.isConnected = false;
        appState.isInRoom = false;
        showJoinButtonLoading(false);
        showStatusLoading(false);
        updateConnectionStatus('disconnected', 'Disconnected');
        disableMessageInput();
        
        if (reason === 'io server disconnect') {
            showToast('Server disconnected', 'warning');
            showLoginForm();
        } else {
            showToast('Connection lost', 'warning');
        }
    });

    // Receive new message
    appState.socket.on('message', (data) => {
        displayMessage(data.message, data.timestamp, data.userName, data.isSystem);
    });

    // User joined room
    appState.socket.on('user-joined', (data) => {
        showToast(`${data.userName} joined the room`, 'success');
    });

    // User left room
    appState.socket.on('user-left', (data) => {
        showToast(`${data.userName} left the room`, 'warning');
    });

    // Handle server errors
    appState.socket.on('error', (error) => {
        console.error('Server error:', error);
        showToast('Server error occurred', 'error');
    });
}

// Setup login form listeners
function setupLoginListeners() {
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // Real-time validation
    elements.userNameInput.addEventListener('input', validateLoginForm);
    elements.roomIdInput.addEventListener('input', validateLoginForm);
}

// Setup chat interface listeners
function setupChatListeners() {
    // Form submission
    elements.messageForm.addEventListener('submit', handleMessageSubmit);

    // Input character counter
    elements.messageInput.addEventListener('input', updateCharCounter);

    // Enter key to send (without Shift)
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleMessageSubmit(e);
        }
    });

    // Enable/disable send button based on input
    elements.messageInput.addEventListener('input', () => {
        const hasText = elements.messageInput.value.trim().length > 0;
        elements.sendButton.disabled = !hasText || !appState.isConnected;
    });

    // Leave room button
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);

    // Clear input on Escape key
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.messageInput.value = '';
            updateCharCounter();
            elements.sendButton.disabled = true;
        }
    });
}

// Handle form submission
function handleMessageSubmit(e) {
    e.preventDefault();
    
    if (!appState.isConnected || !appState.isInRoom) {
        showToast('Not connected to room', 'warning');
        return;
    }
    
    const message = elements.messageInput.value.trim();
    
    if (!message) {
        showToast('Please enter a message', 'warning');
        return;
    }
    
    if (message.length > CONFIG.MAX_MESSAGE_LENGTH) {
        showToast(`Message too long (max ${CONFIG.MAX_MESSAGE_LENGTH} characters)`, 'warning');
        return;
    }
    
    // Send message to server
    appState.socket.emit('message', {
        message: message,
        roomId: appState.roomId,
        userName: appState.userName
    });
    
    // Clear input
    elements.messageInput.value = '';
    updateCharCounter();
    elements.sendButton.disabled = true;
    
    // Focus back to input
    elements.messageInput.focus();
}

// Display a message in the chat
function displayMessage(message, timestamp, userName, isSystem = false) {
    // Clear welcome message if it exists
    clearWelcomeMessage();
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSystem ? 'system' : ''}`;
    
    if (!isSystem && userName) {
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const messageAuthor = document.createElement('div');
        messageAuthor.className = 'message-author';
        messageAuthor.textContent = userName;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTimestamp(timestamp);
        
        messageHeader.appendChild(messageAuthor);
        messageHeader.appendChild(messageTime);
        messageElement.appendChild(messageHeader);
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    
    messageElement.appendChild(messageContent);
    
    if (isSystem) {
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = formatTimestamp(timestamp);
        messageElement.appendChild(messageTime);
    }
    
    elements.messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    scrollToBottom();
}

// Clear welcome message
function clearWelcomeMessage() {
    const welcomeMessage = elements.messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

// Show welcome message
function showWelcomeMessage() {
    elements.messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h3>Welcome to Room ${appState.roomId}! 👋</h3>
            <p>You're chatting as <strong>${appState.userName}</strong>. Start typing to join the conversation!</p>
        </div>
    `;
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

// Scroll messages container to bottom
function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// Update connection status
function updateConnectionStatus(status, text) {
    elements.statusIndicator.className = `status-indicator ${status}`;
    elements.statusText.textContent = text;
}

// Enable message input
function enableMessageInput() {
    elements.messageInput.disabled = false;
    elements.messageInput.placeholder = 'Type your message...';
    const hasText = elements.messageInput.value.trim().length > 0;
    elements.sendButton.disabled = !hasText;
}

// Disable message input
function disableMessageInput() {
    elements.messageInput.disabled = true;
    elements.messageInput.placeholder = 'Connecting to server...';
    elements.sendButton.disabled = true;
}

// Update character counter
function updateCharCounter() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = length;
    
    // Update counter styling based on length
    const counter = elements.charCount.parentElement;
    counter.classList.remove('warning', 'danger');
    
    if (length > CONFIG.MAX_MESSAGE_LENGTH * 0.9) {
        counter.classList.add('danger');
    } else if (length > CONFIG.MAX_MESSAGE_LENGTH * 0.8) {
        counter.classList.add('warning');
    }
}

// Auto-resize function (for potential textarea upgrade)
function autoResize() {
    // This can be expanded if input is changed to textarea
    // elements.messageInput.style.height = 'auto';
    // elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
}

// Show toast notification
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, CONFIG.TOAST_DURATION);
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, could pause some operations
    } else {
        // Page is visible, ensure connection is active
        if (!appState.isConnected && appState.socket) {
            appState.socket.connect();
        }
    }
});

// Handle page beforeunload
window.addEventListener('beforeunload', () => {
    if (appState.socket) {
        appState.socket.disconnect();
    }
});

// Utility function to sanitize HTML (additional security)
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// Error handler for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

// Initialize the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging (only in development)
if (typeof window !== 'undefined') {
    window.chatApp = {
        appState,
        CONFIG,
        showToast,
        reconnect: () => appState.socket?.connect(),
        leaveRoom
    };
}
