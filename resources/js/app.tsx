
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';

function App() {
    return (
        <div>
            <h1>AdMind</h1>
            <p>مرحباً بك في منصة إدارة الحملات والعملاء والمحتوى.</p>
        </div>
    );
}

const container = document.getElementById('app');

if (container) {
    createRoot(container).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
