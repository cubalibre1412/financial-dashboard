import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'chart.js/auto'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: '#f8fafc',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Pretendard, system-ui, sans-serif'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '20px' }}>화면 렌더링 중 오류가 발생했습니다</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
              {this.state.error?.message || '알 수 없는 오류'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  try {
                    localStorage.clear();
                  } catch (e) {}
                  window.location.reload();
                }}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                캐시 초기화 및 새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

