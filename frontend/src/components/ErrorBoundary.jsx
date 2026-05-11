import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    const message = (error && (error.message || String(error))) || 'Something went wrong';
    return { hasError: true, message };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0a100d] border border-zinc-800 rounded-2xl p-6 text-center">
            <h2 className="text-2xl font-extrabold mb-2 text-red-400">حدث خطأ غير متوقع</h2>
            <p className="text-zinc-400 text-sm mb-4 break-words">{this.state.message}</p>
            <button onClick={this.handleReset} className="btn-primary px-5 py-2 rounded-full font-bold">
              إعادة المحاولة
            </button>
            <button
              onClick={() => { window.location.href = '/home'; }}
              className="ms-2 btn-outline px-5 py-2 rounded-full font-bold"
            >
              الرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
